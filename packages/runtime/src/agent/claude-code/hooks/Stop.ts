/** Claude가 턴을 끝내면 실행되는 훅으로 응답을 남기고 미이행 규칙이 있으면 턴을 차단한다. */
import {blockTurn} from "~runtime/agent/claude-code/hook.output.js";
import {readStop} from "~runtime/agent/claude-code/payload/turn.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {captureTranscriptCommentary} from "~runtime/agent/claude-code/transcript/transcript.commentary.js";
import {queryDaemonGuardrail} from "~runtime/daemon/ipc/hook.client.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import {turnBlockedEvent} from "~runtime/domain/ingest/model/guardrail.event.model.js";
import {assistantResponseEvent} from "~runtime/domain/ingest/model/message.event.model.js";
import {onSessionEnd} from "~runtime/domain/session/inbound/session.hook.js";
import {subagentSessionId} from "~runtime/domain/session/model/session.event.model.js";
import {onTurnClose} from "~runtime/domain/turn/inbound/turn.hook.js";
import {createMessageId, deterministicUlid} from "~runtime/support/ulid.js";

await runHook("Stop", {
    parse: readStop,
    handler: async (payload) => {
        const stopReason = payload.stopReason ?? "end_turn";
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await captureTranscriptCommentary(payload, target, (events) =>
            onLifecycleEvent(claudeRuntime.ingest, events));

        const isSubagent = payload.agentId !== undefined;
        if (!isSubagent && !payload.stopHookActive && process.env.AGENT_TRACER_GUARDRAIL_BLOCK !== "0") {
            const blocking = await queryDaemonGuardrail(
                target.taskId,
                target.sessionId,
                payload.lastAssistantMessage,
            );
            if (blocking.length > 0) {
                await onLifecycleEvent(
                    claudeRuntime.ingest,
                    blocking.map((verdict) => turnBlockedEvent(target, {
                        ruleId: verdict.ruleId,
                        ruleName: verdict.ruleName,
                        severity: verdict.severity,
                        ...(verdict.expectedPattern !== undefined
                            ? {expectedPattern: verdict.expectedPattern}
                            : {}),
                        actualToolCallCount: verdict.actualToolCallCount,
                    })),
                );
                blockTurn(blocking);
                return;
            }
        }

        // 서브에이전트 턴에는 UserPromptSubmit이 발생하지 않아 열린 턴이 없다.
        const runtimeSessionId = payload.agentId !== undefined
            ? subagentSessionId(payload.agentId)
            : payload.sessionId;
        const turnId = await onTurnClose(claudeRuntime.turn, {
            runtimeSource: claudeRuntime.runtimeSource,
            runtimeSessionId,
            taskId: target.taskId,
            sessionId: target.sessionId,
            agentName: claudeRuntime.runtimeSource,
            stopReason,
            ...(payload.lastAssistantMessage ? {response: payload.lastAssistantMessage} : {}),
            fallbackTurnId: deterministicUlid([
                claudeRuntime.runtimeSource,
                runtimeSessionId,
                KIND.invokeAgent,
            ]),
        });

        await onLifecycleEvent(claudeRuntime.ingest, [
            assistantResponseEvent({...target, turnId}, {
                messageId: createMessageId(),
                stopReason,
                ...(payload.lastAssistantMessage ? {message: payload.lastAssistantMessage} : {}),
                runtimeSource: claudeRuntime.runtimeSource,
            }),
        ]);

        await onSessionEnd(claudeRuntime.session, {
            taskId: target.taskId,
            sessionId: target.sessionId,
            turnId,
            runtimeSource: claudeRuntime.runtimeSource,
            runtimeSessionId,
            summary: isSubagent
                ? `Subagent turn completed (${stopReason})`
                : `Assistant turn completed (${stopReason})`,
            completionReason: "assistant_turn_complete",
            completeTask: isSubagent,
        });
    },
});
