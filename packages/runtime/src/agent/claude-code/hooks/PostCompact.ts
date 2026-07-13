/** 컨텍스트 압축이 끝나면 Claude Code가 실행하는 훅이다. */
import {readPostCompact} from "~runtime/agent/claude-code/payload/turn.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {compactFinishedEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";
import {toTrimmedString} from "~runtime/support/text.js";

const SUMMARY_MAX = 1_000;

await runHook("PostCompact", {
    parse: readPostCompact,
    handler: async (payload) => {
        const target = await ensureClaudeSession(payload.sessionId);
        // compact_summary는 공식 훅 스키마에 없지만 실제 페이로드로 내려온다.
        const summary = toTrimmedString(payload.payload["compact_summary"], SUMMARY_MAX);
        await onLifecycleEvent(claudeRuntime.ingest, [
            compactFinishedEvent(target, payload.trigger, summary || undefined),
        ]);
    },
});
