import {CLAUDE_RUNTIME_SOURCE, PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import type {JsonObject} from "~claude-code/hooks/util/utils.type.js";
import {isRecord} from "~claude-code/hooks/util/utils.js";
import type {RuntimeIngestEvent} from "~shared/events/kinds.js";
import {resolveIngestEndpoint} from "~shared/routing/ingest.routing.js";
import {withTags} from "~shared/semantics/tags.js";
import type {RuntimeSessionEnsureResult} from "~claude-code/hooks/lib/transport/transport.type.js";

function resolveApiBase(): string {
    const explicit = (process.env.MONITOR_BASE_URL ?? "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const port = parseInt(process.env.MONITOR_PORT ?? "", 10) || 3847;
    const host = (process.env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim();
    return `http://${host}:${port}`;
}

/**
 * Reads and accumulates the full stdin stream, then parses it as JSON.
 * Throws on empty input or parse failure. Returns an empty object if the
 * parsed value is not a plain record.
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

/**
 * POSTs a JSON body to the monitor API at the resolved base URL.
 * Enforces a 2-second timeout. Throws on network error or non-2xx response.
 */
export async function postJson<T = JsonObject>(pathname: string, body: unknown): Promise<T> {
    const response = await fetch(`${resolveApiBase()}${pathname}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) {
        throw new Error(`Monitor request failed: ${pathname} (${response.status})`);
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Groups events by their resolved ingest endpoint and fires one POST per group.
 * No tags are applied to the events' metadata.
 */
export async function postEvent(events: RuntimeIngestEvent[]): Promise<void> {
    const groups = new Map<string, RuntimeIngestEvent[]>();
    for (const event of events) {
        const endpoint = resolveIngestEndpoint(event.kind);
        const group = groups.get(endpoint) ?? [];
        group.push(event);
        groups.set(endpoint, group);
    }
    await Promise.all(
        [...groups.entries()].map(([endpoint, batch]) =>
            postJson(endpoint, {events: batch})
        )
    );
}

/**
 * Applies `withTags` to the event's metadata, then posts it via `postEvent`.
 * Mutates the metadata's `tags` field before sending.
 */
export async function postTaggedEvent(event: RuntimeIngestEvent): Promise<void> {
    await postEvent([{...event, metadata: withTags(event.metadata)}]);
}

/**
 * Applies `withTags` to each event's metadata and posts all events,
 * grouping by ingest endpoint.
 */
export async function postTaggedEvents(events: RuntimeIngestEvent[]): Promise<void> {
    await postEvent(events.map((event) => ({...event, metadata: withTags(event.metadata)})));
}

/**
 * Calls `/api/runtime-session-ensure` to create or resume a monitor session.
 * Returns `{ taskId, sessionId, taskCreated, sessionCreated }`. Accepts optional
 * parent linking and a pre-assigned taskId via `opts`.
 */
export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle(),
    opts?: { parentTaskId?: string; parentSessionId?: string; taskId?: string; resume?: boolean }
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        ...(opts?.taskId ?? process.env.MONITOR_TASK_ID
            ? {taskId: opts?.taskId ?? process.env.MONITOR_TASK_ID}
            : {}),
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR,
        ...(opts?.parentTaskId ? {parentTaskId: opts.parentTaskId} : {}),
        ...(opts?.parentSessionId ? {parentSessionId: opts.parentSessionId} : {}),
        ...(opts?.resume === false ? {resume: false} : {})
    });
}
