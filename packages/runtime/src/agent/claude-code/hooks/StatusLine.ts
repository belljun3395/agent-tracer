/** 상태 표시줄 스크립트로 등록되어 API 요청마다 사용량을 스냅샷으로 남기고 첫 줄에 상태 문자열을 낸다. */
import {readStatusLine, type StatusLinePayload} from "~runtime/agent/claude-code/payload/status.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {contextSnapshotEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";

await runHook("StatusLine", {
    parse: readStatusLine,
    handler: async (payload) => {
        // Claude Code는 stdout의 첫 줄만 상태 표시줄로 렌더링한다.
        const statusText = formatStatusText(payload);
        if (statusText) process.stdout.write(`${statusText}\n`);
        if (!payload.hasTelemetry) return;

        // StatusLine 페이로드에는 transcript_path가 없어 재개 판정을 못 한다.
        const target = await ensureClaudeSession(payload.sessionId, undefined, {resume: false});
        await onLifecycleEvent(claudeRuntime.ingest, [contextSnapshotEvent(target, payload.snapshot)]);
    },
});

function formatStatusText(payload: StatusLinePayload): string {
    const parts: string[] = [];
    if (payload.usedPct !== undefined) parts.push(`ctx ${Math.round(payload.usedPct)}%`);
    if (payload.fiveHourPct !== undefined) parts.push(`5h ${Math.round(payload.fiveHourPct)}%`);
    if (payload.costUsd !== undefined && payload.costUsd > 0) parts.push(`$${payload.costUsd.toFixed(3)}`);
    return parts.length > 0 ? `[monitor] ${parts.join(" · ")}` : "";
}
