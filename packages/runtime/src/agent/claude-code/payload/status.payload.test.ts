import {describe, expect, it} from "vitest";
import {readStatusLine} from "~runtime/agent/claude-code/payload/status.payload.js";

describe("상태 표시줄 페이로드 리더", () => {
    it("중첩된 사용량 필드를 스냅샷 속성으로 편다", () => {
        const result = readStatusLine({
            session_id: "session-1",
            version: "2.0.1",
            model: {id: "claude-opus"},
            context_window: {
                used_percentage: 42,
                total_input_tokens: 100,
                total_output_tokens: 20,
                current_usage: {input_tokens: 10},
            },
            cost: {total_cost_usd: 0.5},
            rate_limits: {five_hour: {used_percentage: 8, resets_at: 1000}},
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.hasTelemetry).toBe(true);
        expect(result.value.snapshot).toEqual({
            contextWindowUsedPct: 42,
            contextWindowTotalTokens: 120,
            contextWindowInputTokens: 10,
            rateLimitFiveHourUsedPct: 8,
            rateLimitFiveHourResetsAt: 1000,
            costTotalUsd: 0.5,
            modelId: "claude-opus",
            sessionVersion: "2.0.1",
        });
    });

    it("사용량 수치가 하나도 없으면 텔레메트리가 없다고 본다", () => {
        const result = readStatusLine({session_id: "session-1"});

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.hasTelemetry).toBe(false);
        expect(result.value.snapshot).toEqual({});
    });

    it("세션 식별자가 없으면 건너뛴다", () => {
        expect(readStatusLine({})).toEqual({ok: false, reason: "missing session_id"});
    });
});
