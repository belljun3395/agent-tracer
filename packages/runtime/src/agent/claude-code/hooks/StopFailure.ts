/** API 오류로 턴이 끝나면 Claude Code가 실행하는 훅이다. */
import {readStopFailure} from "~runtime/agent/claude-code/payload/turn.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {turnFailedEvent} from "~runtime/domain/ingest/model/message.event.model.js";
import {createMessageId} from "~runtime/support/ulid.js";

await runHook("StopFailure", {
    parse: readStopFailure,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            turnFailedEvent(target, {
                messageId: createMessageId(),
                errorType: payload.errorType,
                ...(payload.errorMessage !== undefined ? {errorMessage: payload.errorMessage} : {}),
                runtimeSource: claudeRuntime.runtimeSource,
            }),
        ]);
    },
});
