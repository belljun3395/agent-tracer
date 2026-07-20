import {readMonitorConfigFile, resolveMonitorIdentity} from "~runtime/config/monitor.identity.js";
import {ensureAgentTracerHome, resolveAgentTracerPaths} from "~runtime/config/home.paths.js";
import {listSpoolSegments} from "~runtime/config/spool.js";
import {writeAgentTracerConfig} from "~runtime/config/config.store.js";
import {resolveDaemonSettings} from "~runtime/config/daemon.settings.js";
import {composeDaemonHooks} from "~runtime/daemon/composition.js";
import {daemonLog} from "~runtime/daemon/daemon.log.js";
import {isServerReachable} from "~runtime/daemon/delivery/ingest.retry.js";
import {buildControlSnapshot, type DaemonRuntimeState} from "~runtime/daemon/control/control.state.js";
import type {ConfigUpdateInput, ConfigUpdateResult} from "~runtime/daemon/control/control.actions.js";
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

const paths = resolveAgentTracerPaths();
const version = resolveDaemonVersion();
const bootSettings = resolveDaemonSettings(process.env, paths);
const controlPort = bootSettings.controlPort;
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
let lastActivityAt = Date.now();
let activeConnections = 0;
let shuttingDown = false;
let lastHookVersion: string | null = null;
let rulesRefreshedAt: number | null = null;
let rulesFailedAt: number | null = null;

const spoolSender = new SpoolSender({
    paths,
    history: spoolHistory,
    health,
    daemonVersion: version,
    spoolMaxBytes: bootSettings.spoolMaxBytes,
    poisonAttempts: bootSettings.poisonAttempts,
    onActivity: touch,
    onOwnershipLost: () => void shutdown("ownership-lost"),
});

function applyConfigUpdate(input: ConfigUpdateInput): ConfigUpdateResult {
    writeAgentTracerConfig({userId: input.userId, baseUrl: input.baseUrl, daemon: input.daemon}, paths);
    return {
        identity: resolveMonitorIdentity(process.env, readMonitorConfigFile(paths)),
        daemon: resolveDaemonSettings(process.env, paths),
    };
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

async function refreshRuleSetting(): Promise<void> {
    await onRuleGenerationSettingRefresh(hooks.rulegen);
}

function currentState(): DaemonRuntimeState {
    return {
        ...spoolSender.state(),
        version,
        hookVersion: lastHookVersion,
        pid: process.pid,
        startedAt,
        entryPath: process.argv[1] ?? "unknown",
        identity: resolveMonitorIdentity(),
        activeConnections,
        lastActivityAt,
        idleShutdownMs: bootSettings.idleShutdownMs,
        swallowedErrors: health.swallowedErrorCount,
        rules: cachedRules,
        caches: {
            rules: {
                lastRefreshAt: rulesRefreshedAt,
                lastFailureAt: rulesFailedAt,
                intervalMs: bootSettings.rulesRefreshMs,
                entries: cachedRules.length,
            },
        },
        ring: ring.stats(),
        interventions: interventions.snapshot(),
        settings: bootSettings,
    };
}

function currentDelivery(): DaemonDeliveryResponse {
    return {
        reachable: isServerReachable(spoolSender.state().lastSendOutcome),
        baseUrl: resolveMonitorIdentity().baseUrl,
        backlogBytes: listSpoolSegments(paths).reduce((total, segment) => total + segment.size, 0),
    };
}

async function shutdown(reason: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    spoolSender.stop();
    daemonLog(`${reason} — final flush`);
    servers.close();
    await releaseRunningRuleGenerationJobs(hooks.rulegen);
    await spoolSender.finalFlush();
    removeDaemonPid(paths);
    process.exit(0);
}

function refreshAll(): void {
    void refreshRules();
    void refreshRuleSetting();
}

const controlActions: ControlActions = {
    snapshot: () => buildControlSnapshot(currentState(), paths),
    flush: () => spoolSender.flushNow(),
    resetBackoff: () => spoolSender.resetBackoff(),
    refreshCaches: refreshAll,
    restart: () => void shutdown("control-restart"),
    stop: () => void shutdown("control-stop"),
    updateConfig: applyConfigUpdate,
};

ensureAgentTracerHome(paths);
const controlToken = ensureResumeToken(paths);
const servers = createDaemonServers({
    paths,
    controlPort,
    rebindRetryMs: bootSettings.controlRebindRetryMs,
    onConnection: createDaemonConnectionHandler({
        version,
        ring,
        interventions,
        guardrail: hooks.guardrail,
        hint: hooks.hint,
        recipe: hooks.recipe,
        memo: hooks.memo,
        readRules: () => cachedRules,
        readDelivery: currentDelivery,
        findTargetBySession: hooks.findTargetBySession,
        setTaskTitle: (taskId, title) => hooks.setTaskTitle.execute(taskId, title),
        appendIngestEvents: (events) => hooks.appendIngestEvents.execute(events),
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
        if (shuttingDown) return;
        void refreshRules();
        void refreshRuleSetting();
    }, bootSettings.rulesRefreshMs),
    setInterval(() => {
        if (!shuttingDown) void onRuleGenerationPoll(hooks.rulegen);
    }, bootSettings.ruleGenPollMs),
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
        if (Date.now() - lastActivityAt < bootSettings.idleShutdownMs) return;
        daemonLog(`idle ${bootSettings.idleShutdownMs}ms — exiting`);
        void shutdown("idle-timeout");
    }, bootSettings.idleCheckMs),
];
for (const timer of timers) timer.unref();

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
