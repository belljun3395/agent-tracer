/**
 * Codex App-Server Observer
 *
 * A long-running background process that tails the Codex rollout JSONL file
 * and forwards token-usage and rate-limit snapshots to the Agent Tracer monitor.
 *
 * Codex writes rollout events to:
 *   ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<timestamp>-<sessionId>.jsonl
 *
 * Rollout line types consumed here:
 *   event_msg    { type: "event_msg", payload: { type: "token_count", info, rate_limits } }
 *     Carries cumulative and per-turn token counts and rate-limit windows.
 *   turn_context { type: "turn_context", payload: { turn_id, model } }
 *     Carries the current turn ID and model identifier.
 *   response_item { type: "custom_tool_call" | "function_call" | "web_search_call", ... }
 *     Carries plain Codex tool activity for apply_patch, MCP calls, and web search/fetch.
 *
 * On each state change (new token counts, new rate limits, or new turn ID),
 * this process posts a contextSnapshot event via the Agent Tracer ingest API.
 * Tool response items are forwarded as tool/activity events so normal `codex`
 * sessions get non-Bash observation without going through app-server mode.
 *
 * The observer is launched by the SessionStart hook and terminates on SIGINT
 * or SIGTERM. It writes its PID to observer.json so subsequent SessionStart
 * invocations can detect and replace a stale observer.
 *
 * CLI options:
 *   --thread-id <id>      Observe a specific Codex session id
 *   --latest-in <dir>     Read hint from .codex/agent-tracer/latest-session.json
 *   --project-dir <dir>   Alias of --latest-in
 *   --session-marker <id> Runtime session marker (overrides hint file)
 *   --model <modelId>     Override model id when rollout metadata is unavailable
 *   --rollout <path>      Explicit rollout .jsonl path (skip sessions-tree lookup)
 *   --quiet               Do not print [monitor] status text to stdout
 *   --help, -h            Show this help text
 */
import * as path from "node:path";
import type { RuntimeIngestEvent } from "~shared/events/kinds.type.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferMcpSemantic } from "~shared/semantics/inference.coordination.js";
import { inferExploreSemantic } from "~shared/semantics/inference.explore.js";
import { inferFileToolSemantic } from "~shared/semantics/inference.file.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";
import {
    ensureRuntimeSession,
    postTaggedEvent,
} from "~codex/lib/transport/transport.js";
import {ellipsize, toTrimmedString} from "~codex/util/utils.js";
import {readLatestSessionState} from "~codex/util/session.state.js";
import {
    clearObserverState,
    isPidRunning,
    readObserverState,
    writeObserverState,
} from "~codex/util/session.state.js";
import {
    buildCodexContextSnapshotEvent,
    formatCodexStatusText,
} from "./telemetry.js";
import {
    readRolloutSessionMeta,
    resolveRolloutPath,
    tailRolloutEvents,
    type RolloutEvent,
} from "./rollout.js";
import type {
    CodexAppServerRateLimitSnapshot,
    CodexAppServerThreadTokenUsage,
} from "./protocol.type.js";

interface ObserveArgs {
    readonly threadId?: string;
    readonly latestIn?: string;
    readonly modelId?: string;
    readonly sessionMarker?: string;
    readonly rolloutPath?: string;
    readonly quiet: boolean;
    readonly help: boolean;
}

export interface ObserverState {
    modelId: string | undefined;
    modelProvider: string | undefined;
    tokenUsage: CodexAppServerThreadTokenUsage | undefined;
    rateLimits: CodexAppServerRateLimitSnapshot | undefined;
    turnId: string | undefined;
    observedThreadId: string | undefined;
}

export interface RolloutObservedEventContext {
    readonly taskId: string;
    readonly sessionId: string;
    readonly threadId?: string;
    readonly turnId?: string;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const target = await resolveObserverTarget(args);
    const runtimeSessionId = target.sessionId;
    if (!runtimeSessionId) {
        throw new Error("No runtime session marker found. Start Codex once so hooks can persist a latest-session hint.");
    }

    const observerProjectDir = args.latestIn;
    if (observerProjectDir) {
        const existing = await readObserverState(observerProjectDir);
        if (
            existing
            && existing.pid !== process.pid
            && existing.sessionId === runtimeSessionId
            && isPidRunning(existing.pid)
        ) {
            return;
        }
        await writeObserverState({
            pid: process.pid,
            sessionId: runtimeSessionId,
            startedAt: new Date().toISOString(),
        }, observerProjectDir);
    }

    const runtime = await ensureRuntimeSession(runtimeSessionId);

    const abort = new AbortController();
    const stop = (exitCode: number): void => {
        abort.abort();
        if (observerProjectDir) void clearObserverState(observerProjectDir);
        process.exit(exitCode);
    };
    process.on("SIGINT", () => stop(130));
    process.on("SIGTERM", () => stop(143));

    const rolloutPath = await resolveRolloutPath(runtimeSessionId, {
        ...(args.rolloutPath ? { rolloutPath: args.rolloutPath } : {}),
        signal: abort.signal,
    });
    const meta = await readRolloutSessionMeta(rolloutPath);

    const state: ObserverState = {
        modelId: target.modelId ?? meta?.modelId,
        modelProvider: meta?.modelProvider,
        tokenUsage: undefined,
        rateLimits: undefined,
        turnId: undefined,
        observedThreadId: meta?.sessionId ?? runtimeSessionId,
    };

    let lastStatusText = "";
    const emitSnapshot = async (): Promise<void> => {
        const event = buildCodexContextSnapshotEvent({
            taskId: runtime.taskId,
            sessionId: runtime.sessionId,
            ...(state.observedThreadId ? { threadId: state.observedThreadId } : {}),
            ...(state.modelId ? { modelId: state.modelId } : {}),
            ...(state.modelProvider ? { modelProvider: state.modelProvider } : {}),
            ...(state.tokenUsage ? { tokenUsage: state.tokenUsage } : {}),
            ...(state.rateLimits ? { rateLimits: state.rateLimits } : {}),
        });
        await postTaggedEvent(event);

        if (!args.quiet) {
            const statusText = formatCodexStatusText({
                ...(state.tokenUsage ? { tokenUsage: state.tokenUsage } : {}),
                ...(state.rateLimits ? { rateLimits: state.rateLimits } : {}),
            });
            if (statusText && statusText !== lastStatusText) {
                lastStatusText = statusText;
                process.stdout.write(`${statusText}\n`);
            }
        }
    };

    try {
        for await (const payload of tailRolloutEvents(rolloutPath, abort.signal)) {
            if (applyRolloutPayloadToObserverState(payload, state)) {
                await emitSnapshot();
            }
            const observedEvents = buildRolloutObservedEvents(payload, {
                taskId: runtime.taskId,
                sessionId: runtime.sessionId,
                ...(state.observedThreadId ? { threadId: state.observedThreadId } : {}),
                ...(state.turnId ? { turnId: state.turnId } : {}),
            });
            for (const event of observedEvents) {
                await postTaggedEvent(event);
            }
        }
    } catch (error) {
        if (!abort.signal.aborted) throw error;
    } finally {
        if (observerProjectDir) await clearObserverState(observerProjectDir);
    }
}

/**
 * Applies a single rollout event to the mutable observer state.
 * Returns true if any field changed (triggering a snapshot emit).
 *
 * tokenCount events update tokenUsage and rateLimits independently.
 * turnContext events update turnId and modelId only when they change,
 * avoiding redundant snapshot posts for repeated identical values.
 */
export function applyRolloutPayloadToObserverState(
    payload: RolloutEvent,
    state: ObserverState,
): boolean {
    let changed = false;
    if (payload.kind === "tokenCount") {
        if (payload.tokenUsage) {
            state.tokenUsage = payload.tokenUsage;
            changed = true;
        }
        if (payload.rateLimits) {
            state.rateLimits = payload.rateLimits;
            changed = true;
        }
        return changed;
    }
    if (payload.kind !== "turnContext") return false;
    if (payload.turnId && payload.turnId !== state.turnId) {
        state.turnId = payload.turnId;
        changed = true;
    }
    if (payload.modelId && payload.modelId !== state.modelId) {
        state.modelId = payload.modelId;
        changed = true;
    }
    return changed;
}

export function buildRolloutObservedEvents(
    payload: RolloutEvent,
    context: RolloutObservedEventContext,
): RuntimeIngestEvent[] {
    switch (payload.kind) {
        case "applyPatch":
            return [buildApplyPatchEvent(payload, context)];
        case "mcpCall":
            return [buildMcpCallEvent(payload, context)];
        case "webSearch":
            return [buildWebSearchEvent(payload, context)];
        default:
            return [];
    }
}

function buildApplyPatchEvent(
    payload: Extract<RolloutEvent, { kind: "applyPatch" }>,
    context: RolloutObservedEventContext,
): RuntimeIngestEvent {
    const primaryPath = payload.filePaths[0] ?? "";
    const semantic = inferFileToolSemantic("apply_patch", primaryPath || undefined);
    return {
        kind: KIND.toolUsed,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: primaryPath ? `Apply patch: ${path.basename(primaryPath)}` : "Apply patch",
        body: primaryPath ? `Codex applied a patch touching ${primaryPath}.` : "Codex applied a patch.",
        lane: LANE.implementation,
        ...(payload.filePaths.length > 0 ? { filePaths: payload.filePaths } : {}),
        metadata: {
            ...baseRolloutMetadata("Observed directly from the plain Codex rollout response_item custom_tool_call."),
            ...buildSemanticMetadata(semantic),
            toolName: "apply_patch",
            ...(payload.callId ? { toolUseId: payload.callId } : {}),
            ...(context.threadId ? { threadId: context.threadId } : {}),
            ...(context.turnId ? { turnId: context.turnId } : {}),
            changeCount: payload.filePaths.length,
            patchLineCount: payload.input.split(/\r?\n/).length,
            ...(primaryPath ? { filePath: primaryPath, relPath: primaryPath } : {}),
        },
    };
}

function buildMcpCallEvent(
    payload: Extract<RolloutEvent, { kind: "mcpCall" }>,
    context: RolloutObservedEventContext,
): RuntimeIngestEvent {
    return {
        kind: KIND.agentActivityLogged,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: `MCP: ${payload.server}/${payload.tool}`,
        body: `Used MCP tool ${payload.server}/${payload.tool}`,
        lane: LANE.coordination,
        metadata: {
            ...baseRolloutMetadata("Observed directly from the plain Codex rollout response_item function_call."),
            ...buildSemanticMetadata(inferMcpSemantic(payload.server, payload.tool, payload.name)),
            activityType: "mcp_call",
            mcpServer: payload.server,
            mcpTool: payload.tool,
            toolInput: isRecord(payload.arguments) ? payload.arguments : { value: payload.arguments },
            ...(payload.callId ? { toolUseId: payload.callId } : {}),
            ...(context.threadId ? { threadId: context.threadId } : {}),
            ...(context.turnId ? { turnId: context.turnId } : {}),
        },
    };
}

function buildWebSearchEvent(
    payload: Extract<RolloutEvent, { kind: "webSearch" }>,
    context: RolloutObservedEventContext,
): RuntimeIngestEvent {
    const target = resolveWebTarget(payload);
    const semantic = inferExploreSemantic(target.toolName, { queryOrUrl: target.value });
    return {
        kind: KIND.toolUsed,
        taskId: context.taskId,
        sessionId: context.sessionId,
        title: `${target.label}: ${ellipsize(target.value, 100)}`,
        body: target.value,
        lane: LANE.exploration,
        metadata: {
            ...baseRolloutMetadata("Observed directly from the plain Codex rollout response_item web_search_call."),
            ...buildSemanticMetadata(semantic),
            toolName: "web_search_call",
            ...(payload.callId ? { toolUseId: payload.callId } : {}),
            ...(context.threadId ? { threadId: context.threadId } : {}),
            ...(context.turnId ? { turnId: context.turnId } : {}),
            ...(payload.status ? { itemStatus: payload.status } : {}),
            ...(payload.actionType ? { actionType: payload.actionType } : {}),
            ...(payload.url ? { webUrls: [payload.url] } : {}),
            ...(payload.queries.length > 0 ? { queries: payload.queries } : {}),
            ...(payload.pattern ? { pattern: payload.pattern } : {}),
        },
    };
}

function baseRolloutMetadata(reason: string): Record<string, unknown> {
    return {
        ...provenEvidence(reason),
        source: "codex-rollout",
    };
}

function resolveWebTarget(payload: Extract<RolloutEvent, { kind: "webSearch" }>): { label: string; toolName: "WebFetch" | "WebSearch"; value: string } {
    const actionType = payload.actionType?.toLowerCase() ?? "";
    const isFetch = Boolean(payload.url && (actionType.includes("open") || actionType.includes("find") || actionType.includes("fetch")));
    if (isFetch && payload.url) {
        return { label: "Web fetch", toolName: "WebFetch", value: payload.url };
    }
    return {
        label: "Web search",
        toolName: "WebSearch",
        value: payload.query ?? payload.queries[0] ?? payload.pattern ?? payload.url ?? "web search",
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(argv: readonly string[]): ObserveArgs {
    let threadId = "";
    let latestIn = "";
    let modelId = "";
    let sessionMarker = "";
    let rolloutPath = "";
    let quiet = false;
    let help = false;

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--thread-id") {
            threadId = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (token === "--latest-in" || token === "--project-dir") {
            latestIn = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (token === "--model") {
            modelId = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (token === "--session-marker") {
            sessionMarker = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (token === "--rollout") {
            rolloutPath = argv[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (token === "--quiet") {
            quiet = true;
            continue;
        }
        if (token === "--help" || token === "-h") {
            help = true;
        }
    }

    return {
        ...(toTrimmedString(threadId) ? { threadId: toTrimmedString(threadId) } : {}),
        ...(toTrimmedString(latestIn) ? { latestIn: toTrimmedString(latestIn) } : {}),
        ...(toTrimmedString(modelId) ? { modelId: toTrimmedString(modelId) } : {}),
        ...(toTrimmedString(sessionMarker) ? { sessionMarker: toTrimmedString(sessionMarker) } : {}),
        ...(toTrimmedString(rolloutPath) ? { rolloutPath: toTrimmedString(rolloutPath) } : {}),
        quiet,
        help,
    };
}

function printHelp(): void {
    process.stdout.write(
        [
            "Usage:",
            "  npm run codex:observe -- --latest-in /absolute/path/to/project",
            "  npm run codex:observe -- --thread-id <codex-session-id>",
            "",
            "Options:",
            "  --thread-id <id>      Observe a specific Codex session id (same value as thread id for plain codex)",
            "  --latest-in <dir>     Read .codex/agent-tracer/latest-session.json from a project",
            "  --project-dir <dir>   Alias of --latest-in",
            "  --session-marker <id> Runtime session marker (takes precedence over hint file)",
            "  --model <modelId>     Override model id when rollout metadata is unavailable",
            "  --rollout <path>      Explicit rollout .jsonl path (skip sessions-tree lookup)",
            "  --quiet               Do not print [monitor] status text to stdout",
            "  --help, -h            Show this help text",
            "",
        ].join("\n"),
    );
}

interface ResolvedTarget {
    readonly sessionId: string | undefined;
    readonly modelId?: string;
}

/**
 * Resolves which session to observe.
 * Priority: --session-marker / --thread-id > latest-session hint file.
 * Returns { sessionId: undefined } when no session can be determined.
 */
async function resolveObserverTarget(args: ObserveArgs): Promise<ResolvedTarget> {
    const explicitId = args.sessionMarker ?? args.threadId;
    if (explicitId) {
        return {
            sessionId: explicitId,
            ...(args.modelId ? { modelId: args.modelId } : {}),
        };
    }

    const latest = await readLatestSessionState(args.latestIn);
    if (!latest) {
        return {
            sessionId: undefined,
            ...(args.modelId ? { modelId: args.modelId } : {}),
        };
    }
    return {
        sessionId: latest.sessionId,
        ...(args.modelId ? { modelId: args.modelId } : latest.modelId ? { modelId: latest.modelId } : {}),
    };
}

if (!process.env.VITEST) {
    void main().catch((error: unknown) => {
        process.stderr.write(`${String(error)}\n`);
        process.exit(1);
    });
}
