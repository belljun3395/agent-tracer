import { Column, Entity, PrimaryColumn } from "typeorm";

/** 원장 이벤트의 PostgreSQL 저장 스키마다. */
@Entity({ name: "events" })
export class LedgerEventEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "seq", type: "bigint", insert: false, update: false })
    seq!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;

    @Column({ type: "text" })
    kind!: string;

    // occurred_at은 시간 파티션 키라 PK에 포함된다.
    @PrimaryColumn({ name: "occurred_at", type: "timestamptz" })
    occurredAt!: Date;

    @Column({ name: "received_at", type: "timestamptz", insert: false })
    receivedAt!: Date;

    // row 하나가 단독으로 OTLP 레코드가 되도록 인제스트 시점에 확정한다.
    @Column({ name: "trace_id", type: "text" })
    traceId!: string;

    @Column({ name: "span_id", type: "text" })
    spanId!: string;

    @Column({ name: "parent_span_id", type: "text", nullable: true })
    parentSpanId!: string | null;

    @Column({ type: "jsonb" })
    payload!: Record<string, unknown>;
}
