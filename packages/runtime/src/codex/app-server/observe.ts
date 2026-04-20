import {
    ensureRuntimeSession,
    postTaggedEvent,
} from "~codex/lib/transport/transport.js";
import { toTrimmedString } from "~codex/util/utils.js";
import { readLatestSessionState } from "~codex/util/session.state.js";
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
        }
    } catch (error) {
        if (!abort.signal.aborted) throw error;
    } finally {
        if (observerProjectDir) await clearObserverState(observerProjectDir);
    }
}

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
