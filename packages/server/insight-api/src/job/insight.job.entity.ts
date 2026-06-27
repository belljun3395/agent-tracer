import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type InsightJobType = "recipe_scan" | "task_cleanup";

export type InsightJobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Outbox row for the insight context's asynchronous LLM-backed jobs:
 * recipe scan (mining rule candidates from tasks) and task cleanup (suggesting
 * archivable tasks). The two share one `insight_jobs` table behind a `jobType`
 * discriminator; type-specific fields are typed nullable columns so each job
 * stays readable and the repository/lifecycle stays shared.
 */
@Entity({ name: "insight_jobs" })
@Index("idx_insight_jobs_user_type_status", ["userId", "jobType", "status", "createdAt"])
export class InsightJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    /** 이 잡을 실행한 사용자. */
    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "job_type", type: "text" })
    jobType!: InsightJobType;

    @Column({ type: "text" })
    status!: InsightJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    /** recipe_scan: JSON snapshot of the scan filters. */
    @Column({ name: "filters_json", type: "text", nullable: true })
    filtersJson!: string | null;

    /** recipe_scan: output language override. */
    @Column({ type: "text", nullable: true })
    language!: string | null;

    /** recipe_scan result. */
    @Column({ name: "candidates_created", type: "integer", nullable: true })
    candidatesCreated!: number | null;

    /** task_cleanup result. */
    @Column({ name: "suggestions_created", type: "integer", nullable: true })
    suggestionsCreated!: number | null;

    /** recipe_scan + task_cleanup result. */
    @Column({ name: "tasks_scanned", type: "integer", nullable: true })
    tasksScanned!: number | null;

    @Column({ name: "model_used", type: "text", nullable: true })
    modelUsed!: string | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    /** LLM run cost in USD. Null for the Messages API runner (no cost reported)
     * and non-LLM jobs (rule_backfill). */
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
