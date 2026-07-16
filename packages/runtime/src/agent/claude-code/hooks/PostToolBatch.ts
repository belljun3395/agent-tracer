/** 병렬 도구 호출 배치가 모두 끝나면 Claude Code가 실행하는 훅이다. */
import {readPostToolBatch} from "~runtime/agent/claude-code/payload/tool.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {toolBatchEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";

await runHook("PostToolBatch", {
    parse: readPostToolBatch,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType, payload.transcriptPath);
        await onLifecycleEvent(claudeRuntime.ingest, [
            toolBatchEvent(target, payload.toolCalls.map((call) => call.toolName)),
        ]);
    },
});
