import {resolveMonitorBaseUrl} from "~runtime/config/env.js";
import {ensureAgentTracerHome, resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {listSpoolSegments} from "~runtime/config/spool.js";
import {composeDaemonHooks} from "~runtime/daemon/composition.js";
import {isServerReachable} from "~runtime/daemon/delivery/ingest.retry.js";
import {buildControlSnapshot, type DaemonRuntimeState} from "~runtime/daemon/control/control.state.js";
import {createControlHttpHandler, type ControlActions} from "~runtime/daemon/control/control.http.js";
import {createResumeHttpHandler} from "~runtime/daemon/control/resume.http.js";
import {ensureResumeToken} from "~runtime/daemon/control/resume.token.js";
import {SpoolSender} from "~runtime/daemon/delivery/spool.sender.js";
import {createDaemonConnectionHandler} from "~runtime/daemon/ipc/socket.server.js";
import type {DaemonDeliveryResponse} from "~runtime/daemon/port/daemon.socket.port.js";
import {DaemonHealthTracker, resolveDaemonVersion} from "~runtime/daemon/lifecycle/daemon.health.js";
import {removeDaemonPid} from "~runtime/daemon/lifecycle/daemon.pid.js";
import {createDaemonServers} from "~runtime/daemon/lifecycle/servers.js";
import {EventAutomationDispatcher} from "~runtime/daemon/observation/event.automation.js";
import {InterventionLog} from "~runtime/daemon/observation/intervention.log.js";
import {SpoolHistoryObserver} from "~runtime/daemon/observation/spool.history.observer.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {RecentEventRing} from "~runtime/domain/ingest/model/recent.event.model.js";
import {onRecipeScanRequested} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {
    hasRunningRuleGenerationJobs,
    onRuleGenerationPoll,
    onRuleGenerationSettingRefresh,
    onUserInputForRuleGeneration,
    releaseRunningRuleGenerationJobs,
} from "~runtime/domain/rulegen/inbound/rulegen.hook.js";
import {onRulesRefresh} from "~runtime/domain/guardrail/inbound/guardrail.hook.js";
import {onRecipeCacheRefresh} from "~runtime/domain/recipe/inbound/recipe.hook.js";

const RECIPE_REFRESH_MS = 5 * 60 * 1000;
const RULES_REFRESH_MS = 10 * 1000;
const RULE_GEN_POLL_MS = 10 * 1000;
const IDLE_SHUTDOWN_MS = 5 * 60 * 1000;
const IDLE_CHECK_MS = 30_000;
const CONTROL_REBIND_RETRY_MS = 2000;
const DEFAULT_CONTROL_PORT = 3848;

const paths = resolveAgentTracerPaths();
const version = resolveDaemonVersion();
const controlPort = resolveControlPort(process.env.AGENT_TRACER_RESUME_PORT);
const startedAt = Date.now();

const hooks = composeDaemonHooks(`daemon-${process.pid}`);
const ring = new RecentEventRing();
const health = new DaemonHealthTracker();
const interventions = new InterventionLog();
const automation = new EventAutomationDispatcher([
    (event) => onUserInputForRuleGeneration(hooks.rulegen, event.kind, event.taskId, event.eventId, event.prompt),
    async (event) => {
        await onRecipeScanRequested(hooks.recipe, {
            taskId: event.taskId,
            eventId: event.eventId,
            prompt: event.prompt,
        });
    },
]);
const spoolHistory = new SpoolHistoryObserver({
    paths,
    ring,
    onEvent: (event) => automation.dispatch(event),
    recordSwallowedError: () => health.recordSwallowedError(),
});

let cachedRules: readonly GuardrailRule[] = [];
let autoRuleGeneration = false;
let lastActivityAt = Date.now();
let activeConnections = 0;
let shuttingDown = false;
let lastHookVersion: string | null = null;
let rulesRefreshedAt: number | null = null;
let rulesFailedAt: number | null = null;
let recipesRefreshedAt: number | null = null;
let recipesFailedAt: number | null = null;

const spoolSender = new SpoolSender({
    paths,
    history: spoolHistory,
    health,
    daemonVersion: version,
    onActivity: touch,
    onOwnershipLost: () => void shutdown("ownership-lost"),
});

function resolveControlPort(value: string | undefined): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : DEFAULT_CONTROL_PORT;
}

function touch(): void {
    lastActivityAt = Date.now();
}

async function refreshRules(): Promise<void> {
    const rules = await onRulesRefresh(hooks.guardrail);
    if (rules === null) {
        rulesFailedAt = Date.now();
        health.recordSwallowedError();
        return;
    }
    cachedRules = rules;
    rulesRefreshedAt = Date.now();
}

async function refreshRecipes(): Promise<void> {
    try {
        const refreshed = await onRecipeCacheRefresh(hooks.recipe);
        if (!refreshed) throw new Error("recipe cache refresh rejected");
        recipesRefreshedAt = Date.now();
    } catch {
        recipesFailedAt = Date.now();
        health.recordSwallowedError();
    }
}

async function refreshAutoTrigger(): Promise<void> {
    const setting = await onRuleGenerationSettingRefresh(hooks.rulegen);
    autoRuleGeneration = setting.enabled;
}

function currentState(): DaemonRuntimeState {
    return {
        ...spoolSender.state(),
        version,
        hookVersion: lastHookVersion,
        pid: process.pid,
        startedAt,
        entryPath: process.argv[1] ?? "unknown",
        baseUrl: resolveMonitorBaseUrl(),
        activeConnections,
        lastActivityAt,
        idleShutdownMs: IDLE_SHUTDOWN_MS,
        swallowedErrors: health.swallowedErrorCount,
        rules: cachedRules,
        caches: {
            rules: {
                lastRefreshAt: rulesRefreshedAt,
                lastFailureAt: rulesFailedAt,
                intervalMs: RULES_REFRESH_MS,
                entries: cachedRules.length,
            },
            recipes: {
                lastRefreshAt: recipesRefreshedAt,
                lastFailureAt: recipesFailedAt,
                intervalMs: RECIPE_REFRESH_MS,
                entries: hooks.recipeCache.load().length,
            },
            autoRuleGeneration,
        },
        ring: ring.stats(),
        interventions: interventions.snapshot(),
    };
}

function currentDelivery(): DaemonDeliveryResponse {
    return {
        reachable: isServerReachable(spoolSender.state().lastSendOutcome),
        baseUrl: resolveMonitorBaseUrl(),
        backlogBytes: listSpoolSegments(paths).reduce((total, segment) => total + segment.size, 0),
    };
}

async function shutdown(reason: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    spoolSender.stop();
    process.stderr.write(`[agent-tracer-daemon] ${reason} — final flush\n`);
    servers.close();
    await releaseRunningRuleGenerationJobs(hooks.rulegen);
    await spoolSender.finalFlush();
    removeDaemonPid(paths);
    process.exit(0);
}

function refreshAll(): void {
    void refreshRecipes();
    void refreshRules();
    void refreshAutoTrigger();
}

const controlActions: ControlActions = {
    snapshot: () => buildControlSnapshot(currentState(), paths),
    flush: () => spoolSender.flushNow(),
    resetBackoff: () => spoolSender.resetBackoff(),
    refreshCaches: refreshAll,
    restart: () => void shutdown("control-restart"),
    stop: () => void shutdown("control-stop"),
};

ensureAgentTracerHome(paths);
const controlToken = ensureResumeToken(paths);
const servers = createDaemonServers({
    paths,
    controlPort,
    rebindRetryMs: CONTROL_REBIND_RETRY_MS,
    onConnection: createDaemonConnectionHandler({
        version,
        ring,
        interventions,
        guardrail: hooks.guardrail,
        hint: hooks.hint,
        readRules: () => cachedRules,
        readDelivery: currentDelivery,
        refreshHistory: () => spoolSender.feedHistory(),
        onHookVersion: (hookVersion) => {
            lastHookVersion = hookVersion;
        },
        onActivity: touch,
        onConnectionOpened: () => {
            activeConnections += 1;
        },
        onConnectionClosed: () => {
            activeConnections = Math.max(0, activeConnections - 1);
        },
        recordSwallowedError: () => health.recordSwallowedError(),
        shutdown: (reason) => void shutdown(reason),
    }),
    resumeHandler: createResumeHttpHandler(controlToken),
    controlHandler: createControlHttpHandler({token: controlToken, actions: controlActions, paths}),
    onActivity: touch,
    onSocketReady: () => {
        refreshAll();
        void onRuleGenerationPoll(hooks.rulegen);
        spoolSender.start();
    },
    isShuttingDown: () => shuttingDown,
});

servers.start();

const timers = [
    setInterval(() => {
        if (!shuttingDown) void refreshRecipes();
    }, RECIPE_REFRESH_MS),
    setInterval(() => {
        if (shuttingDown) return;
        void refreshRules();
        void refreshAutoTrigger();
    }, RULES_REFRESH_MS),
    setInterval(() => {
        if (!shuttingDown) void onRuleGenerationPoll(hooks.rulegen);
    }, RULE_GEN_POLL_MS),
    setInterval(() => {
        if (shuttingDown) return;
        if (
            spoolSender.hasPendingSegments()
            || activeConnections > 0
            || spoolSender.isBackingOff()
            || hasRunningRuleGenerationJobs(hooks.rulegen)
        ) {
            touch();
            return;
        }
        if (Date.now() - lastActivityAt < IDLE_SHUTDOWN_MS) return;
        process.stderr.write(`[agent-tracer-daemon] idle ${IDLE_SHUTDOWN_MS}ms — exiting\n`);
        void shutdown("idle-timeout");
    }, IDLE_CHECK_MS),
];
for (const timer of timers) timer.unref();

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
