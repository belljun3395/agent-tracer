import type { EventKind } from "~kernel/ingest/event.kind.const.js";

export const OTLP_SERVICE_NAME = "agent-tracer-runtime";

export interface OtlpEventRecord {
    readonly id: string;
    readonly kind: EventKind;
    readonly taskId: string;
    readonly sessionId: string | null;
    readonly traceId: string;
    readonly spanId: string;
    readonly parentSpanId: string | null;
    readonly occurredAt: Date;
    readonly payload: Record<string, unknown>;
}

export interface OtlpKeyValue {
    readonly key: string;
    readonly value: Record<string, unknown>;
}
