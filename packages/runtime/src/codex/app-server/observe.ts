import { spawn } from "node:child_process";
import * as readline from "node:readline";
import {
    ensureRuntimeSession,
    postTaggedEvent,
} from "~codex/lib/transport/transport.js";
import { parseJsonLine, toTrimmedString } from "~codex/util/utils.js";
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
import type {
    CodexAppServerNotification,
    CodexAppServerRateLimitSnapshot,
    CodexAppServerRateLimitWindow,
    CodexAppServerThreadTokenUsage,
} from "./protocol.type.js";

interface ObserveArgs {
    readonly threadId?: string;
    readonly latestIn?: string;
    readonly modelId?: string;
    readonly sessionMarker?: string;
    readonly quiet: boolean;
    readonly help: boolean;
}

interface JsonRpcMessage {
    readonly id?: number;
    readonly method?: string;
    readonly params?: unknown;
    readonly result?: unknown;
    readonly error?: {
        readonly code?: number;
        readonly message?: string;
    };
}

export interface ObserverState {
    modelId: string | undefined;
    modelProvider: string | undefined;
    tokenUsage: CodexAppServerThreadTokenUsage | undefined;
    rateLimits: CodexAppServerRateLimitSnapshot | undefined;
    turnId: string | undefined;
    observedThreadId: string | undefined;
}

const REQUEST_ID = {
    initialize: 1,
    accountRateLimitsRead: 2,
    threadResume: 3,
    threadList: 4,
} as const;

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const target = await resolveObserverTarget(args);
    const observerProjectDir = args.latestIn;
    if (observerProjectDir) {
        const existing = await readObserverState(observerProjectDir);
        if (
            existing
            && existing.pid !== process.pid
            && existing.sessionId === (args.sessionMarker ?? target.sessionMarker ?? target.threadId)
            && isPidRunning(existing.pid)
        ) {
            return;
        }
        await writeObserverState({
            pid: process.pid,
            ...(args.sessionMarker ?? target.sessionMarker ?? target.threadId
                ? { sessionId: args.sessionMarker ?? target.sessionMarker ?? target.threadId }
                : {}),
            startedAt: new Date().toISOString(),
        }, observerProjectDir);
    }

    const runtimeSessionId = args.sessionMarker ?? target.sessionMarker ?? target.threadId;
    if (!runtimeSessionId) {
        throw new Error("No runtime session marker found. Start Codex once so hooks can persist a latest-session hint.");
    }
    const runtime = await ensureRuntimeSession(runtimeSessionId);
    const state: ObserverState = {
        modelId: target.modelId,
        modelProvider: undefined,
        tokenUsage: undefined,
        rateLimits: undefined,
        turnId: undefined,
        observedThreadId: target.threadId,
    };

    const child = spawn("codex", ["app-server"], {
        stdio: ["pipe", "pipe", "inherit"],
    });

    const stopChild = (): void => {
        if (!child.killed) {
            child.kill();
        }
    };

    process.on("SIGINT", () => {
        stopChild();
        process.exit(130);
    });
    process.on("SIGTERM", () => {
        stopChild();
        process.exit(143);
    });
    const cleanupObserverState = (): void => {
        if (!observerProjectDir) return;
        void clearObserverState(observerProjectDir);
    };
    process.on("exit", cleanupObserverState);

    const rl = readline.createInterface({ input: child.stdout });
    let lastStatusText = "";

    const emitSnapshot = async (): Promise<void> => {
        const event = buildCodexContextSnapshotEvent({
            taskId: runtime.taskId,
            sessionId: runtime.sessionId,
            ...(state.observedThreadId ? { threadId: state.observedThreadId } : {}),
            ...(state.turnId ? { turnId: state.turnId } : {}),
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

    rl.on("line", (line) => {
        void handleMessage(line, target.threadId ?? "", state, emitSnapshot, stopChild, (message) => send(child, message));
    });

    child.once("exit", (code, signal) => {
        if (code !== 0 && signal == null) {
            process.stderr.write(`codex app-server exited with code ${code ?? -1}\n`);
            process.exit(code ?? 1);
        }
        process.exit(0);
    });

    send(child, {
        method: "initialize",
        id: REQUEST_ID.initialize,
        params: {
            clientInfo: {
                name: "agent-tracer-codex-observer",
                title: "Agent Tracer Codex Observer",
                version: "0.1.0",
            },
        },
    });
    send(child, { method: "initialized", params: {} });
    send(child, { method: "account/rateLimits/read", id: REQUEST_ID.accountRateLimitsRead });
    if (target.threadId) {
        send(child, {
            method: "thread/resume",
            id: REQUEST_ID.threadResume,
            params: {
                threadId: target.threadId,
            },
        });
    } else if (target.cwd) {
        send(child, {
            method: "thread/list",
            id: REQUEST_ID.threadList,
            params: {
                cwd: target.cwd,
                limit: 10,
                sortKey: "updated_at",
                archived: false,
            },
        });
    }
}

async function handleMessage(
    line: string,
    targetThreadId: string,
    state: ObserverState,
    emitSnapshot: () => Promise<void>,
    stopChild: () => void,
    sendMessage: (message: unknown) => void,
): Promise<void> {
    const parsed = parseJsonLine(line) as JsonRpcMessage | null;
    if (!parsed) return;

    if (typeof parsed.id === "number") {
        await handleResponse(parsed, state, emitSnapshot, sendMessage);
        return;
    }

    if (!parsed.method) return;
    await handleNotification(parsed as JsonRpcMessage & { method: string }, targetThreadId, state, emitSnapshot, stopChild);
}

async function handleResponse(
    message: JsonRpcMessage,
    state: ObserverState,
    emitSnapshot: () => Promise<void>,
    sendMessage: (message: unknown) => void,
): Promise<void> {
    if (message.error) {
        throw new Error(message.error.message ?? `JSON-RPC request failed (${message.id ?? "unknown"})`);
    }

    const shouldEmit = applyResponseToObserverState(message, state, sendMessage);
    if (shouldEmit) {
        await emitSnapshot();
    }
}

export function applyResponseToObserverState(
    message: JsonRpcMessage,
    state: ObserverState,
    sendMessage: (message: unknown) => void = () => undefined,
): boolean {
    if (message.id === REQUEST_ID.threadResume) {
        const result = asRecord(message.result);
        const resumedThreadId = toTrimmedString(asRecord(result?.["thread"])?.["id"]);
        const nextModelId = toTrimmedString(result?.["model"]) || state.modelId;
        const nextModelProvider = toTrimmedString(result?.["modelProvider"]) || state.modelProvider;
        const changed = nextModelId !== state.modelId
            || nextModelProvider !== state.modelProvider
            || resumedThreadId !== state.observedThreadId;
        state.observedThreadId = resumedThreadId || state.observedThreadId;
        state.modelId = nextModelId;
        state.modelProvider = nextModelProvider;
        return changed && (!!state.rateLimits || !!state.tokenUsage);
    }

    if (message.id === REQUEST_ID.threadList) {
        const result = asRecord(message.result);
        const threadId = selectThreadIdForObservation(result?.["data"]);
        if (!threadId) return false;
        state.observedThreadId = threadId;
        sendMessage({
            method: "thread/resume",
            id: REQUEST_ID.threadResume,
            params: {
                threadId,
            },
        });
        return false;
    }

    if (message.id === REQUEST_ID.accountRateLimitsRead) {
        const result = asRecord(message.result);
        const rateLimits = asRateLimitSnapshot(result?.["rateLimits"]);
        if (!rateLimits) return false;
        state.rateLimits = rateLimits;
        return true;
    }

    return false;
}

async function handleNotification(
    notification: JsonRpcMessage & { method: string },
    targetThreadId: string,
    state: ObserverState,
    emitSnapshot: () => Promise<void>,
    stopChild: () => void,
): Promise<void> {
    const typed = notification as CodexAppServerNotification;

    switch (typed.method) {
        case "thread/tokenUsage/updated":
            if (targetThreadId && typed.params.threadId !== targetThreadId && typed.params.threadId !== state.observedThreadId) return;
            state.observedThreadId = typed.params.threadId;
            state.turnId = typed.params.turnId;
            state.tokenUsage = typed.params.tokenUsage;
            await emitSnapshot();
            return;
        case "account/rateLimits/updated":
            state.rateLimits = typed.params.rateLimits;
            await emitSnapshot();
            return;
        case "thread/closed":
            if (typed.params.threadId === targetThreadId || typed.params.threadId === state.observedThreadId) {
                stopChild();
            }
            return;
        default:
            return;
    }
}

function send(child: ReturnType<typeof spawn>, message: unknown): void {
    if (!child.stdin) {
        throw new Error("codex app-server stdin is unavailable");
    }
    child.stdin.write(`${JSON.stringify(message)}\n`);
}

function parseArgs(argv: readonly string[]): ObserveArgs {
    let threadId = "";
    let latestIn = "";
    let modelId = "";
    let sessionMarker = "";
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
        quiet,
        help,
    };
}

function printHelp(): void {
    process.stdout.write(
        [
            "Usage:",
            "  npm run codex:observe -- --thread-id <codex-thread-id>",
            "  npm run codex:observe -- --latest-in /absolute/path/to/project",
            "",
            "Options:",
            "  --thread-id <id>     Observe a specific Codex thread id",
            "  --latest-in <dir>    Read .codex/agent-tracer/latest-session.json from a project",
            "  --project-dir <dir>  Alias of --latest-in",
            "  --session-marker <id> Runtime session marker used only for observer lifecycle",
            "  --model <modelId>    Override model id when resume metadata is unavailable",
            "  --quiet              Do not print [monitor] status text to stdout",
            "  --help, -h           Show this help text",
            "",
        ].join("\n"),
    );
}

async function resolveObserverTarget(args: ObserveArgs): Promise<{ threadId?: string; modelId?: string; sessionMarker?: string; cwd?: string }> {
    if (args.threadId) {
        return {
            threadId: args.threadId,
            ...(args.modelId ? { modelId: args.modelId } : {}),
            ...(args.sessionMarker ? { sessionMarker: args.sessionMarker } : {}),
        };
    }

    const latest = await readLatestSessionState(args.latestIn);
    if (!latest) {
        throw new Error(
            "No Codex session hint found. Pass --thread-id <threadId> or --latest-in <projectDir> after starting Codex once.",
        );
    }

    return {
        ...(args.modelId ? { modelId: args.modelId } : latest.modelId ? { modelId: latest.modelId } : {}),
        sessionMarker: latest.sessionId,
        ...(args.latestIn ? { cwd: args.latestIn } : {}),
    };
}

function selectThreadIdForObservation(value: unknown): string | null {
    if (!Array.isArray(value)) return null;
    for (const item of value) {
        const record = asRecord(item);
        const threadId = toTrimmedString(record?.["id"]);
        if (threadId) return threadId;
    }
    return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function asString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function asRateLimitSnapshot(value: unknown): CodexAppServerRateLimitSnapshot | null {
    const record = asRecord(value);
    if (!record) return null;

    return {
        limitId: asNullableString(record["limitId"]),
        limitName: asNullableString(record["limitName"]),
        primary: asRateLimitWindow(record["primary"]),
        secondary: asRateLimitWindow(record["secondary"]),
    };
}

function asRateLimitWindow(value: unknown): CodexAppServerRateLimitWindow | null {
    const record = asRecord(value);
    if (!record) return null;
    const usedPercent = asNumber(record["usedPercent"]);
    if (usedPercent == null) return null;

    return {
        usedPercent,
        windowDurationMins: asNullableNumber(record["windowDurationMins"]),
        resetsAt: asNullableNumber(record["resetsAt"]),
    };
}

function asNumber(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
    return value == null ? null : asNumber(value);
}

function asNullableString(value: unknown): string | null {
    return value == null ? null : asString(value);
}

if (!process.env.VITEST) {
    void main().catch((error: unknown) => {
        process.stderr.write(`${String(error)}\n`);
        process.exit(1);
    });
}
