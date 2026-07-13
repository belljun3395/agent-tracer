import type { EventKind } from "@monitor/kernel";
import { readString } from "~projector/support/payload.read.js";

/** 원장 메시지를 검증하고 정규화한 프로젝션 입력이며 project·index·export 슬라이스가 함께 읽는다. */
export interface LedgerRecord {
    readonly id: string;
    readonly seq: string;
    readonly userId: string;
    readonly taskId: string;
    readonly sessionId: string | null;
    readonly kind: EventKind;
    readonly occurredAt: Date;
    readonly receivedAt: Date;
    readonly traceId: string;
    readonly spanId: string;
    readonly parentSpanId: string | null;
    readonly payload: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function toDate(value: unknown): Date | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// payload는 객체이거나 JSON 문자열로 실려 올 수 있다.
function toPayload(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null) return {};
    if (typeof value === "string") {
        try {
            const parsed: unknown = JSON.parse(value);
            return asRecord(parsed);
        } catch {
            return null;
        }
    }
    return asRecord(value);
}

function toSeq(value: unknown): string {
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;
    return "0";
}

// 파싱 불가한 메시지는 null을 돌려 호출부가 로그 후 건너뛰게 한다.
export function parseLedgerRecord(raw: Buffer | string | null): LedgerRecord | null {
    if (raw === null) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
    } catch {
        return null;
    }
    const row = asRecord(parsed);
    if (row === null) return null;

    const id = readString(row, "id");
    const userId = readString(row, "user_id");
    const taskId = readString(row, "task_id");
    const kind = readString(row, "kind");
    // 식별자나 종류가 없으면 처리할 수 없다.
    if (id === undefined || userId === undefined || taskId === undefined || kind === undefined) return null;

    const occurredAt = toDate(row["occurred_at"]);
    if (occurredAt === null) return null;

    const traceId = readString(row, "trace_id");
    const spanId = readString(row, "span_id");
    // OTLP 식별자가 없는 행은 컷오버 이후 존재할 수 없는 구 포맷이라 건너뛴다.
    if (traceId === undefined || spanId === undefined) return null;

    const payload = toPayload(row["payload"]);
    // payload가 손상되어 파싱되지 않으면 건너뛴다.
    if (payload === null) return null;

    return {
        id,
        seq: toSeq(row["seq"]),
        userId,
        taskId,
        sessionId: readString(row, "session_id") ?? null,
        kind: kind as EventKind,
        occurredAt,
        receivedAt: toDate(row["received_at"]) ?? occurredAt,
        traceId,
        spanId,
        parentSpanId: readString(row, "parent_span_id") ?? null,
        payload,
    };
}
