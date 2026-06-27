import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type TaskCleanupSuggestionKind =
    | "archive"
    | "rename_title"
    | "set_parent"
    | "reslug";

export type TaskCleanupSuggestionStatus =
    | "pending"
    | "accepted"
    | "dismissed"
    | "failed";

@Entity({ name: "task_cleanup_suggestions" })
@Index("idx_task_cleanup_sugg_status", ["status", "createdAt"])
@Index("idx_task_cleanup_sugg_job", ["jobId"])
@Index("idx_task_cleanup_sugg_task", ["taskId"])
export class TaskCleanupSuggestionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    kind!: TaskCleanupSuggestionKind;

    /** JSON-serialized snapshot of the current value (or null for inferred fields). */
    @Column({ name: "current_value", type: "text", nullable: true })
    currentValue!: string | null;

    /** JSON-serialized proposed value (e.g. {"title": "New title"} or {"parentTaskId": "abc"}). */
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

    /** Awaiting a human decision — the only state from which it can be accepted/dismissed. */
    isPending(): boolean {
        return this.status === "pending";
    }

    /** Reached a terminal state (accepted / dismissed / failed). */
    isResolved(): boolean {
        return this.status !== "pending";
    }
}
