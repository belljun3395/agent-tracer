/** 서브에이전트가 끝나면 Claude Code가 실행하는 훅으로 완료를 남기고 이미 바인딩된 가상 세션만 종료한다. */
import {readSubagentStop} from "~runtime/agent/claude-code/payload/agent.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {captureTranscriptCommentary} from "~runtime/agent/claude-code/transcript/transcript.commentary.js";
import {onBindingLookup} from "~runtime/domain/binding/inbound/binding.hook.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {subagentFinishedEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";
import {onSessionEnd} from "~runtime/domain/session/inbound/session.hook.js";
import {subagentSessionId} from "~runtime/domain/session/model/session.event.model.js";
import {toTrimmedString} from "~runtime/support/text.js";

const LAST_MESSAGE_MAX = 400;

await runHook("SubagentStop", {
    parse: readSubagentStop,
    handler: async (payload) => {
        const agentId = payload.agentId;
        if (agentId === undefined) return;

        const parent = await ensureClaudeSession(payload.sessionId, undefined, {
            transcriptPath: payload.transcriptPath,
        });
        const virtualId = subagentSessionId(agentId);
        // Claude Code는 SubagentStart를 항상 발화하지 않으므로 이미 만들어진 바인딩만 종료한다.
        const child = onBindingLookup(claudeRuntime.binding, claudeRuntime.runtimeSource, virtualId);
        if (child !== undefined) {
            await captureTranscriptCommentary(payload, child, (events) =>
                onLifecycleEvent(claudeRuntime.ingest, events));
        }

        const lastMessage = toTrimmedString(payload.lastAssistantMessage, LAST_MESSAGE_MAX);
        await onLifecycleEvent(claudeRuntime.ingest, [
            subagentFinishedEvent(parent, {
                agentId,
                agentType: payload.subagentType,
                parentSessionId: payload.sessionId,
                ...(lastMessage ? {lastMessage} : {}),
            }),
        ]);

        if (child !== undefined) {
            await onSessionEnd(claudeRuntime.session, {
                taskId: child.taskId,
                sessionId: child.sessionId,
                ...(child.turnId !== undefined ? {turnId: child.turnId} : {}),
                runtimeSource: claudeRuntime.runtimeSource,
                runtimeSessionId: virtualId,
                summary: `Subagent finished: ${payload.subagentType}`,
                completionReason: "assistant_turn_complete",
                completeTask: true,
            });
        }

        claudeRuntime.todoSnapshots.clear(virtualId);
    },
});
