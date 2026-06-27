import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RuleJobType = "rule_generation" | "rule_backfill";

export type RuleJobStatus = "pending" | "processing" | "completed" | "failed";

@Entity({ name: "rule_jobs" })
@Index("idx_rule_jobs_user_type_status", ["userId", "jobType", "status", "createdAt"])
@Index("idx_rule_jobs_task", ["taskId", "createdAt"])
export class RuleJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "job_type", type: "text" })
    jobType!: RuleJobType;

    @Column({ type: "text" })
    status!: RuleJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ name: "rule_id", type: "text", nullable: true })
    ruleId!: string | null;

    @Column({ name: "rules_created", type: "integer", nullable: true })
    rulesCreated!: number | null;

    @Column({ name: "verdicts_created", type: "integer", nullable: true })
    verdictsCreated!: number | null;

    @Column({ name: "model_used", type: "text", nullable: true })
    modelUsed!: string | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "cost_usd", type: "double precision", nullable: true })
    costUsd!: number | null;

    @Column({ name: "input_tokens", type: "integer", nullable: true })
    inputTokens!: number | null;

    @Column({ name: "output_tokens", type: "integer", nullable: true })
    outputTokens!: number | null;

    @Column({ name: "cache_read_tokens", type: "integer", nullable: true })
    cacheReadTokens!: number | null;

    @Column({ name: "cache_creation_tokens", type: "integer", nullable: true })
    cacheCreationTokens!: number | null;

    @Column({ name: "num_turns", type: "integer", nullable: true })
    numTurns!: number | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    @Column({ name: "started_at", type: "text", nullable: true })
    startedAt!: string | null;

    @Column({ name: "completed_at", type: "text", nullable: true })
    completedAt!: string | null;
}
