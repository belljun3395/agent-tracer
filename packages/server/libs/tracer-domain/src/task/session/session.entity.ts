import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { SESSION_STATUS, type SessionStatus } from "../task.const.js";

@Entity({ name: "sessions" })
@Index("sessions_task", ["taskId", "startedAt"])
export class SessionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "runtime_source", type: "text" })
    runtimeSource!: string;

    @Column({ name: "runtime_session_id", type: "text" })
    runtimeSessionId!: string;

    @Column({ type: "text" })
    status!: SessionStatus;

    @Column({ type: "text", nullable: true })
    summary!: string | null;

    @Column({ name: "started_at", type: "timestamptz" })
    startedAt!: Date;

    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null;

    end(summary: string | null, at: Date): void {
        // 이미 종료된 세션은 다시 종료하지 않는다.
        if (this.status === SESSION_STATUS.ended) return;
        this.status = SESSION_STATUS.ended;
        this.endedAt = at;
        if (summary !== null) this.summary = summary;
    }
}
