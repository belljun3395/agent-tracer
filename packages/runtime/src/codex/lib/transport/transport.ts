import {CODEX_RUNTIME_SOURCE, PROJECT_DIR} from "~codex/util/paths.const.js";
import {defaultTaskTitle} from "~codex/util/paths.js";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {readStdinJson} from "~shared/hook-runtime/index.js";
import type {RuntimeSessionEnsureResult} from "~shared/hook-runtime/transport.js";

export {readStdinJson};
export type {RuntimeSessionEnsureResult};

export const postJson = codexHookRuntime.transport.postJson;
export const postEvent = codexHookRuntime.transport.postEvent;
export const postTaggedEvent = codexHookRuntime.transport.postTaggedEvent;
export const postTaggedEvents = codexHookRuntime.transport.postTaggedEvents;

/**
 * Calls `/ingest/v1/sessions/ensure` to create or resume a monitor session.
 */
export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle(),
): Promise<RuntimeSessionEnsureResult> {
    return postJson<RuntimeSessionEnsureResult>("/ingest/v1/sessions/ensure", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId,
        title,
        workspacePath: PROJECT_DIR,
    });
}
