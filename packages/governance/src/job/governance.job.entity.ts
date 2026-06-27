import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type GovernanceJobType =
    | "recipe_scan"
    | "rule_generation"
    | "rule_backfill"
    | "task_cleanup";

export type GovernanceJobStatus =
    | "pending"
    | "processing"
    | "completed"
    | "failed";

/**
 * Unified outbox row for the asynchronous LLM-backed governance jobs
 * (recipe scan, rule generation, task cleanup). The three used to be separate
 * near-identical tables; they are merged here behind a `jobType` discriminator.
 * Type-specific fields are kept as typed nullable columns so each job stays
 * readable and the worker/repository/lifecycle can be shared.
 */
@Entity({ name: "governance_jobs" })
@Index("idx_governance_jobs_user_type_status", ["userId", "jobType", "status", "createdAt"])
@Index("idx_governance_jobs_task", ["taskId", "createdAt"])
export class GovernanceJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    /** 이 잡을 실행한 사용자. */
    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "job_type", type: "text" })
    jobType!: GovernanceJobType;

    @Column({ type: "text" })
    status!: GovernanceJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    /** rule_generation: the task the rules are generated for. */
    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    /** rule_backfill: the rule to re-evaluate across its scope. */
    @Column({ name: "rule_id", type: "text", nullable: true })
    ruleId!: string | null;

    /** recipe_scan: JSON snapshot of the scan filters. */
    @Column({ name: "filters_json", type: "text", nullable: true })
    filtersJson!: string | null;

    /** recipe_scan: output language override. */
    @Column({ type: "text", nullable: true })
    language!: string | null;

    /** recipe_scan result. */
    @Column({ name: "candidates_created", type: "integer", nullable: true })
    candidatesCreated!: number | null;

    /** rule_generation result. */
    @Column({ name: "rules_created", type: "integer", nullable: true })
    rulesCreated!: number | null;

    /** task_cleanup result. */
    @Column({ name: "suggestions_created", type: "integer", nullable: true })
    suggestionsCreated!: number | null;

    /** rule_backfill result. */
    @Column({ name: "verdicts_created", type: "integer", nullable: true })
    verdictsCreated!: number | null;

    /** recipe_scan + task_cleanup result. */
    @Column({ name: "tasks_scanned", type: "integer", nullable: true })
    tasksScanned!: number | null;

    @Column({ name: "model_used", type: "text", nullable: true })
    modelUsed!: string | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    @Column({ name: "started_at", type: "text", nullable: true })
    startedAt!: string | null;

    @Column({ name: "completed_at", type: "text", nullable: true })
    completedAt!: string | null;
}
