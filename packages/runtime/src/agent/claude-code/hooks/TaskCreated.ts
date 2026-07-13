/** 태스크가 생성되면 Claude Code가 실행하는 훅이다. */
import {readTaskLifecycle} from "~runtime/agent/claude-code/payload/agent.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {todoLifecycleEvent} from "~runtime/domain/ingest/model/todo.tool.model.js";

await runHook("TaskCreated", {
    parse: readTaskLifecycle,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            todoLifecycleEvent(target, {
                taskName: payload.taskName,
                todoState: "added",
                source: "TaskCreated",
                status: "pending",
                ...(payload.taskDescription !== undefined ? {body: payload.taskDescription} : {}),
            }),
        ]);
    },
});
