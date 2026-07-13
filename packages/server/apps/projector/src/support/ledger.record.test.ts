import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { parseLedgerRecord } from "~projector/support/ledger.record.js";

function row(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
        id: "event-1",
        seq: 7,
        user_id: "user-1",
        task_id: "task-1",
        session_id: "session-1",
        kind: KIND.userMessage,
        occurred_at: "2026-07-10T00:00:00.000Z",
        received_at: "2026-07-10T00:00:01.000Z",
        trace_id: "0123456789abcdef0123456789abcdef",
        span_id: "0123456789abcdef",
        payload: { title: "hi" },
        ...overrides,
    });
}

describe("parseLedgerRecord", () => {
    it("원장 행의 OTLP 식별자를 그대로 실어 나른다", () => {
        const record = parseLedgerRecord(row({ parent_span_id: "fedcba9876543210" }));
        expect(record?.traceId).toBe("0123456789abcdef0123456789abcdef");
        expect(record?.spanId).toBe("0123456789abcdef");
        expect(record?.parentSpanId).toBe("fedcba9876543210");
    });

    it("인과 부모가 없으면 parentSpanId는 비운다", () => {
        expect(parseLedgerRecord(row())?.parentSpanId).toBeNull();
    });

    it("OTLP 식별자가 없는 구 포맷 행은 건너뛴다", () => {
        expect(parseLedgerRecord(row({ trace_id: undefined }))).toBeNull();
        expect(parseLedgerRecord(row({ span_id: undefined }))).toBeNull();
    });

    it("파싱할 수 없는 메시지는 건너뛴다", () => {
        expect(parseLedgerRecord("not json")).toBeNull();
        expect(parseLedgerRecord(null)).toBeNull();
    });
});
