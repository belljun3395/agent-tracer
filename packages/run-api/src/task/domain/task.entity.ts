import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    MonitoringTaskKind,
    TaskOrigin,
    TaskStatus,
} from "@monitor/run-api/task/common/task.status.const.js";

@Entity({ name: "tasks" })
@Index("idx_tasks_user_updated", ["userId", "updatedAt"])
export class TaskEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    /** 이 태스크를 소유한 사용자. */
    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    slug!: string;

    @Column({ name: "workspace_path", type: "text", nullable: true })
    workspacePath!: string | null;

    @Column({ type: "text" })
    status!: TaskStatus;

    @Column({ name: "task_kind", type: "text" })
    taskKind!: MonitoringTaskKind;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    @Column({ name: "last_session_started_at", type: "text", nullable: true })
    lastSessionStartedAt!: string | null;

    @Column({ name: "cli_source", type: "text", nullable: true })
    cliSource!: string | null;

    @Column({ name: "archived_at", type: "text", nullable: true })
    archivedAt!: string | null;

    /**
     * Marks who created this task. `user` (default) means an end-user-driven
     * Claude Code / Codex session; `server-sdk` means the server itself
     * launched a Claude Agent SDK query for an internal job (title
     * suggestion, task cleanup, recipe scan, rule generation).
     */
    @Column({ type: "text", default: "user" })
    origin!: TaskOrigin;

    /** Convenience accessor — runtime source is stored as cli_source historically. */
    get runtimeSource(): string | null {
        return this.cliSource?.trim() ?? null;
    }

    /** Whether this task has been archived. */
    isArchived(): boolean {
        return this.archivedAt != null;
    }

    /**
     * Archives the task at the given instant. Archiving implies the user is
     * done with the task, so a running/waiting task is flipped to completed;
     * an errored task keeps its status because the error is the information
     * worth preserving.
     */
    archive(nowIso: string): void {
        this.archivedAt = nowIso;
        this.updatedAt = nowIso;
        if (this.status === "running" || this.status === "waiting") {
            this.status = "completed";
        }
    }

    /** Reverses {@link archive}. The lifecycle status is left untouched. */
    unarchive(nowIso: string): void {
        this.archivedAt = null;
        this.updatedAt = nowIso;
    }
}
