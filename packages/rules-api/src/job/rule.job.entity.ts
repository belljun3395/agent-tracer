import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RuleJobType = "rule_generation" | "rule_backfill";

export type RuleJobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Outbox row for the rules context's asynchronous LLM-backed jobs:
 * rule generation (from a task) and rule backfill (re-evaluating a rule across
 * its scope). The two share one `rule_jobs` table behind a `jobType`
 * discriminator; type-specific fields are typed nullable columns so each job
 * stays readable and the repository/lifecycle stays shared.
 */
@Entity({ name: "rule_jobs" })
@Index("idx_rule_jobs_user_type_status", ["userId", "jobType", "status", "createdAt"])
@Index("idx_rule_jobs_task", ["taskId", "createdAt"])
export class RuleJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    /** 이 잡을 실행한 사용자. */
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

    /** rule_generation: the task the rules are generated for. */
    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    /** rule_backfill: the rule to re-evaluate across its scope. */
    @Column({ name: "rule_id", type: "text", nullable: true })
    ruleId!: string | null;

    /** rule_generation result. */
    @Column({ name: "rules_created", type: "integer", nullable: true })
    rulesCreated!: number | null;

    /** rule_backfill result. */
    @Column({ name: "verdicts_created", type: "integer", nullable: true })
    verdictsCreated!: number | null;

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
