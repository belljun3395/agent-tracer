import { describe, expect, it, vi } from "vitest";
import { KIND } from "@monitor/kernel";
import { extractEventFields } from "./event.fields.js";
import type { LedgerRecord } from "./ledger.record.js";

vi.mock("@monitor/tracer-domain", () => ({ EventEntity: class EventEntity {} }));

describe("extractEventFields", () => {
    it("token.usage의 모델과 컨텍스트 metadata를 timeline 필드로 보존한다", () => {
        const metadata = {
            model: "gpt-5.6-sol",
            contextWindowTotalTokens: 25_573,
            contextWindowSize: 353_400,
        };

        const fields = extractEventFields(record({ metadata }));

        expect(fields.metadata).toEqual(metadata);
    });

    it("중간 어시스턴트 발화의 기본 레인을 user로 정한다", () => {
        const fields = extractEventFields(record({}, KIND.assistantCommentary));

        expect(fields.lane).toBe("user");
    });
});

function record(
    payload: Record<string, unknown>,
    kind: LedgerRecord["kind"] = KIND.tokenUsage,
): LedgerRecord {
    return {
        id: "event-1",
        seq: "1",
        userId: "user-1",
        taskId: "task-1",
        sessionId: "session-1",
        kind,
        occurredAt: new Date("2026-07-10T00:00:00.000Z"),
        receivedAt: new Date("2026-07-10T00:00:00.000Z"),
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        parentSpanId: null,
        payload,
    };
}
