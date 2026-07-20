import { Column, Entity, PrimaryColumn } from "typeorm";
import { InvariantViolationError } from "@monitor/tracer-domain/error/invariant.error.js";

@Entity({ name: "task_user_state" })
export class TaskUserStateEntity {
    @PrimaryColumn({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "archived_at", type: "timestamptz", nullable: true })
    archivedAt!: Date | null;

    @Column({ name: "hidden_at", type: "timestamptz", nullable: true })
    hiddenAt!: Date | null;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    archive(now: Date): void {
        // 이미 보관된 항목은 다시 보관할 수 없다.
        if (this.archivedAt !== null) throw new InvariantViolationError("task.already-archived");
        this.archivedAt = now;
        this.updatedAt = now;
    }

    unarchive(now: Date): void {
        this.archivedAt = null;
        this.updatedAt = now;
    }

    hide(now: Date): void {
        this.hiddenAt = now;
        this.updatedAt = now;
    }

    isArchived(): boolean {
        return this.archivedAt !== null;
    }

    isHidden(): boolean {
        return this.hiddenAt !== null;
    }

    static init(taskId: string, userId: string, now: Date): TaskUserStateEntity {
        const state = new TaskUserStateEntity();
        state.taskId = taskId;
        state.userId = userId;
        state.archivedAt = null;
        state.hiddenAt = null;
        state.updatedAt = now;
        return state;
    }
}
