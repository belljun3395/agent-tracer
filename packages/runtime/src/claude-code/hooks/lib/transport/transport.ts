import {CLAUDE_RUNTIME_SOURCE, PROJECT_DIR} from "~claude-code/hooks/util/paths.const.js";
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import { readStdinJson } from "~shared/hook-runtime/stdin.js";
import {resolveMonitorTransportConfig} from "~shared/config/env.js";
import type {RuntimeSessionEnsureResult} from "~shared/hook-runtime/transport.js";

export {readStdinJson};
export type {RuntimeSessionEnsureResult};

export const postJson = claudeHookRuntime.transport.postJson;
export const postEvent = claudeHookRuntime.transport.postEvent;
export const postTaggedEvent = claudeHookRuntime.transport.postTaggedEvent;
export const postTaggedEvents = claudeHookRuntime.transport.postTaggedEvents;

/**
 * Calls `/ingest/v1/sessions/ensure` to create or resume a monitor session.
 * Accepts optional parent linking and a pre-assigned taskId via `opts`.
 *
 * MONITOR_TASK_ORIGIN env, if set to "server-sdk", flags the task as a
 * server-initiated SDK job so the dashboard can route it to the dedicated
 * Subagent view. This is only set by `@monitor/api-gateway`'s internal agents.
 */
export async function ensureRuntimeSession(
    runtimeSessionId: string,
    title: string = defaultTaskTitle(),
    opts?: {parentTaskId?: string; parentSessionId?: string; taskId?: string; resume?: boolean},
): Promise<RuntimeSessionEnsureResult> {
    const transportConfig = resolveMonitorTransportConfig();
    const taskId = opts?.taskId ?? transportConfig.taskIdOverride;
    const effectiveTitle = transportConfig.taskTitleOverride ?? title;
    const origin = transportConfig.taskOriginOverride;
    return postJson<RuntimeSessionEnsureResult>("/ingest/v1/sessions/ensure", {
        ...(taskId ? {taskId} : {}),
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId,
        title: effectiveTitle,
        workspacePath: PROJECT_DIR,
        ...(opts?.parentTaskId ? {parentTaskId: opts.parentTaskId} : {}),
        ...(opts?.parentSessionId ? {parentSessionId: opts.parentSessionId} : {}),
        ...(origin ? {origin} : {}),
        ...(opts?.resume === false ? {resume: false} : {}),
    });
}
