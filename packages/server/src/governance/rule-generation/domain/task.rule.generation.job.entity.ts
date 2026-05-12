import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type TaskRuleGenerationJobStatus =
    | "pending"
    | "processing"
    | "completed"
    | "failed";

@Entity({ name: "task_rule_generation_jobs" })
@Index("idx_task_rule_gen_status", ["status", "createdAt"])
@Index("idx_task_rule_gen_task", ["taskId", "createdAt"])
export class TaskRuleGenerationJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    status!: TaskRuleGenerationJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "rules_created", type: "integer", default: 0 })
    rulesCreated!: number;

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
