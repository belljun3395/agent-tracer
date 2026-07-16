/** 컨텍스트 압축이 시작되기 전에 Claude Code가 실행하는 훅이다. */
import {readPreCompact} from "~runtime/agent/claude-code/payload/turn.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {compactStartedEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";
import {toTrimmedString} from "~runtime/support/text.js";

await runHook("PreCompact", {
    parse: readPreCompact,
    handler: async (payload) => {
        const target = await ensureClaudeSession(payload.sessionId, undefined, {
            transcriptPath: payload.transcriptPath,
        });
        // custom_instructions는 공식 훅 스키마에 없지만 실제 페이로드로 내려온다.
        const instructions = toTrimmedString(payload.payload["custom_instructions"]);
        await onLifecycleEvent(claudeRuntime.ingest, [
            compactStartedEvent(target, payload.trigger, instructions || undefined),
        ]);
    },
});
