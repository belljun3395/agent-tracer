import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { MonitoringTaskKind, TaskStatus } from "~domain/monitoring/common/type/task.status.type.js";

@Entity({ name: "tasks_current" })
@Index("idx_tasks_current_updated", ["updatedAt"])
export class TaskEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

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

    /** Convenience accessor — runtime source is stored as cli_source historically. */
    get runtimeSource(): string | null {
        return this.cliSource?.trim() ?? null;
    }
}
