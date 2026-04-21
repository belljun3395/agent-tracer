import {CLAUDE_RUNTIME_SOURCE, PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import type {RuntimeIngestEvent} from "~shared/events/kinds.js";
import {withTags} from "~shared/semantics/tags.js";
import {
    postJson,
    postEvent,
    readStdinJson,
    postTaggedEvent,
    type RuntimeSessionEnsureResult,
} from "~shared/transport/transport.js";

export {readStdinJson, postJson, postEvent, postTaggedEvent};
export type {RuntimeSessionEnsureResult};

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
    opts?: {parentTaskId?: string; parentSessionId?: string; taskId?: string; resume?: boolean},
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
        ...(opts?.resume === false ? {resume: false} : {}),
    });
}
