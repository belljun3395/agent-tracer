/** 서브에이전트가 생성되면 Claude Code가 실행하는 훅으로 자식 태스크를 미리 만들고 부모에 실행 사실을 남긴다. */
import {readSubagentStart} from "~runtime/agent/claude-code/payload/agent.payload.js";
import {
    claudeRuntime,
    ensureClaudeSession,
    ensureSubagentSession,
    runHook,
} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {subagentStartedEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("SubagentStart", {
    parse: readSubagentStart,
    handler: async (payload) => {
        const agentId = payload.agentId;
        if (agentId === undefined) return;

        const parent = await ensureClaudeSession(payload.sessionId);
        const child = await ensureSubagentSession(
            payload.sessionId,
            agentId,
            payload.subagentType,
            parent,
        );

        await onLifecycleEvent(claudeRuntime.ingest, [
            subagentStartedEvent(parent, {
                agentId,
                agentType: payload.subagentType,
                parentSessionId: payload.sessionId,
                childTaskId: child.taskId,
            }),
        ]);
    },
});
