import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { CLEANUP_SUGGESTION_STATUS } from "./const/task.cleanup.const.js";
import type {
    TaskCleanupSuggestionKind,
    TaskCleanupSuggestionStatus,
} from "./const/task.cleanup.const.js";

@Entity({ name: "task_cleanup_suggestions" })
@Index("idx_task_cleanup_sugg_status", ["userId", "status", "createdAt"])
@Index("idx_task_cleanup_sugg_job", ["jobId"])
@Index("idx_task_cleanup_sugg_task", ["taskId"])
export class TaskCleanupSuggestionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    kind!: TaskCleanupSuggestionKind;

    @Column({ name: "current_value", type: "text", nullable: true })
    currentValue!: string | null;

    @Column({ name: "proposed_value", type: "text", nullable: true })
    proposedValue!: string | null;

    @Column({ type: "text" })
    rationale!: string;

    @Column({ type: "text" })
    status!: TaskCleanupSuggestionStatus;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "resolved_at", type: "text", nullable: true })
    resolvedAt!: string | null;

    isPending(): boolean {
        return this.status === CLEANUP_SUGGESTION_STATUS.pending;
    }

    isResolved(): boolean {
        return this.status !== CLEANUP_SUGGESTION_STATUS.pending;
    }
}
