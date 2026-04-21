import {CODEX_RUNTIME_SOURCE, PROJECT_DIR} from "~codex/util/paths.const.js";
import {defaultTaskTitle} from "~codex/util/paths.js";
import {
    postJson,
    readStdinJson,
    postEvent,
    postTaggedEvent,
    type RuntimeSessionEnsureResult,
} from "~shared/transport/transport.js";

export {readStdinJson, postJson, postEvent, postTaggedEvent};
export type {RuntimeSessionEnsureResult};

/**
 * Calls `/api/runtime-session-ensure` to create or resume a monitor session.
 * Returns `{ taskId, sessionId, taskCreated, sessionCreated }`.
 */
export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle(),
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/api/runtime-session-ensure", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR,
    });
}
