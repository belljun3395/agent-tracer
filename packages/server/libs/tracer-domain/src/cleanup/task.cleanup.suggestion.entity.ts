import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    CLEANUP_SUGGESTION_STATUS,
    type TaskCleanupSuggestionKind,
    type TaskCleanupSuggestionStatus,
} from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";

@Entity({ name: "task_cleanup_suggestions" })
@Index("cleanup_user_status", ["userId", "status", "createdAt"])
@Index("cleanup_pending_task_kind_unique", ["userId", "taskId", "kind"], {
    unique: true,
    where: "\"status\" = 'pending'",
})
export class TaskCleanupSuggestionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
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

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    // 제안을 만들 때 서버가 관찰한 대상 태스크의 마지막 이벤트 시각이며, 수락 시점에 태스크가
    // 그 뒤로 새 활동을 겪었는지 비교하는 기준값이다.
    @Column({ name: "observed_last_event_at", type: "timestamptz", nullable: true })
    observedLastEventAt!: Date | null;

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }

    isAccepted(): boolean {
        return this.status === CLEANUP_SUGGESTION_STATUS.accepted;
    }

    accept(now: Date): void {
        // 대기 중인 제안만 수락할 수 있다.
        if (this.status !== CLEANUP_SUGGESTION_STATUS.pending) throw new InvariantViolationError("cleanup.not-pending");
        this.status = CLEANUP_SUGGESTION_STATUS.accepted;
        this.resolvedAt = now;
    }

    dismiss(now: Date): void {
        // 대기 중인 제안만 기각할 수 있다.
        if (this.status !== CLEANUP_SUGGESTION_STATUS.pending) throw new InvariantViolationError("cleanup.not-pending");
        this.status = CLEANUP_SUGGESTION_STATUS.dismissed;
        this.resolvedAt = now;
    }
}
