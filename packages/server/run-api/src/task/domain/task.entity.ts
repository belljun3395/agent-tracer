import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { COMPLETED_TASK_STATUS, isActiveTaskStatus } from "@monitor/run-api/task/common/task.status.const.js";
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

    @Column({ type: "text", default: "user" })
    origin!: TaskOrigin;

    get runtimeSource(): string | null {
        return this.cliSource?.trim() ?? null;
    }

    isArchived(): boolean {
        return this.archivedAt != null;
    }

    // 보관은 사용자가 작업을 끝냈다는 뜻이므로 running/waiting만 completed로 바꾼다.
    archive(nowIso: string): void {
        this.archivedAt = nowIso;
        this.updatedAt = nowIso;
        if (isActiveTaskStatus(this.status)) {
            this.status = COMPLETED_TASK_STATUS;
        }
    }

    unarchive(nowIso: string): void {
        this.archivedAt = null;
        this.updatedAt = nowIso;
    }
}
