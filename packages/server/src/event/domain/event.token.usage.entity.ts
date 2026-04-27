import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_token_usage" })
@Index("idx_event_token_usage_session", ["sessionId", "occurredAt"])
@Index("idx_event_token_usage_model", ["model"])
@Index("idx_event_token_usage_task", ["taskId", "occurredAt"])
export class EventTokenUsageEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "input_tokens", type: "integer", default: 0 })
    inputTokens!: number;

    @Column({ name: "output_tokens", type: "integer", default: 0 })
    outputTokens!: number;

    @Column({ name: "cache_read_tokens", type: "integer", default: 0 })
    cacheReadTokens!: number;

    @Column({ name: "cache_create_tokens", type: "integer", default: 0 })
    cacheCreateTokens!: number;

    @Column({ name: "cost_usd", type: "real", nullable: true })
    costUsd!: number | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ type: "text", nullable: true })
    model!: string | null;

    @Column({ name: "prompt_id", type: "text", nullable: true })
    promptId!: string | null;

    @Column({ name: "stop_reason", type: "text", nullable: true })
    stopReason!: string | null;

    @Column({ name: "occurred_at", type: "text" })
    occurredAt!: string;
}
