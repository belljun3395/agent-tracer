/**
 * Claude Code Hook: TaskCreated
 *
 * Ref: https://code.claude.com/docs/en/hooks#taskcreated
 *
 * Fires when a task is created via the TaskCreate tool.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "TaskCreated"
 *   task_name        string
 *   task_description string?
 *
 * Blocking: Yes (decision: "block"). This handler never blocks.
 */
import {createStableTodoId} from "~claude-code/hooks/util/utils.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readTaskCreated} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { TodoLoggedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("TaskCreated", {
    logger: claudeHookRuntime.logger,
    parse: readTaskCreated,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const todoId = createStableTodoId(payload.taskName, "medium");

        const metadata: TodoLoggedMetadata = {
            ...provenEvidence("Emitted by the TaskCreated hook."),
            todoId,
            todoState: "added",
            toolName: "TaskCreated",
            status: "pending",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.todoLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.todos,
            title: payload.taskName,
            ...(payload.taskDescription ? {body: payload.taskDescription} : {}),
            metadata,
        });
    },
});
