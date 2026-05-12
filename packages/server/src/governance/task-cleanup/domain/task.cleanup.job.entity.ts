import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type TaskCleanupJobStatus =
    | "pending"
    | "processing"
    | "completed"
    | "failed";

@Entity({ name: "task_cleanup_jobs" })
@Index("idx_task_cleanup_jobs_status", ["status", "createdAt"])
export class TaskCleanupJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ type: "text" })
    status!: TaskCleanupJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "suggestions_created", type: "integer", default: 0 })
    suggestionsCreated!: number;

    @Column({ name: "tasks_scanned", type: "integer", default: 0 })
    tasksScanned!: number;

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
