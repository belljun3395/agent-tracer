import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { SessionSnapshot, SessionStatus } from "./dto/session.snapshot.dto.js";

@Entity({ name: "sessions" })
@Index("idx_sessions_task_started", ["taskId", "startedAt"])
@Index("idx_sessions_task_status_started", ["taskId", "status", "startedAt"])
export class SessionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    status!: SessionStatus;

    @Column({ type: "text", nullable: true })
    summary!: string | null;

    @Column({ name: "started_at", type: "text" })
    startedAt!: string;

    @Column({ name: "ended_at", type: "text", nullable: true })
    endedAt!: string | null;

    end(at: string, status: Exclude<SessionStatus, "running">, summary?: string): void {
        this.status = status;
        this.endedAt = at;
        if (summary !== undefined) this.summary = summary;
    }

    toSnapshot(): SessionSnapshot {
        return {
            id: this.id,
            taskId: this.taskId,
            status: this.status,
            startedAt: this.startedAt,
            ...(this.endedAt ? { endedAt: this.endedAt } : {}),
            ...(this.summary ? { summary: this.summary } : {}),
        };
    }
}
