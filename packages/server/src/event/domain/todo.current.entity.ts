import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "todos_current" })
@Index("idx_todos_task_state", ["taskId", "state"])
export class TodoCurrentEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    state!: string;

    @Column({ type: "text", nullable: true })
    priority!: string | null;

    @Column({ name: "auto_reconciled", type: "integer", default: 0 })
    autoReconciled!: number;

    @Column({ name: "last_event_id", type: "text", nullable: true })
    lastEventId!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;
}
