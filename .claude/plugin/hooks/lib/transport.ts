import { loadApplicationConfig, resolveMonitorHttpBaseUrl } from "../../../../config/load-application-config.js";
import { CLAUDE_RUNTIME_SOURCE, PROJECT_DIR, defaultTaskTitle } from "../util/paths.js";
import type { JsonObject } from "../util/utils.js";
import { isRecord } from "../util/utils.js";

/**
 * Shape of the JSON body returned by POST /api/runtime-session-ensure.
 * Indicates whether a new task or session was created during this call.
 */
export interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
    readonly taskCreated?: boolean;
    readonly sessionCreated?: boolean;
}

const APPLICATION_CONFIG = loadApplicationConfig({ env: process.env });
const API_BASE = resolveMonitorHttpBaseUrl(APPLICATION_CONFIG, process.env);

/**
 * Reads the complete stdin stream and parses it as JSON.
 * Claude Code sends the hook payload as a single JSON object on stdin.
 * Returns an empty object if stdin is empty or the payload is not a plain object.
 * Ref: https://code.claude.com/docs/en/hooks#command-hooks (stdin/stdout protocol)
 */
export async function readStdinJson(): Promise<JsonObject> {
    let raw = "";
    for await (const chunk of process.stdin) {
        raw += String(chunk);
    }
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
}

export async function postJson<T = JsonObject>(pathname: string, body: JsonObject): Promise<T> {
    const response = await fetch(`${API_BASE}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) {
        throw new Error(`Monitor request failed: ${pathname} (${response.status})`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
}

export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle(),
    opts?: { parentTaskId?: string; parentSessionId?: string; taskId?: string }
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        ...(opts?.taskId ?? process.env.MONITOR_TASK_ID
            ? { taskId: opts?.taskId ?? process.env.MONITOR_TASK_ID }
            : {}),
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR,
        ...(opts?.parentTaskId ? { parentTaskId: opts.parentTaskId } : {}),
        ...(opts?.parentSessionId ? { parentSessionId: opts.parentSessionId } : {})
    });
}
