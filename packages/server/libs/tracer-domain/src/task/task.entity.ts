import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    AUTO_TITLE_RANK,
    COMPLETED_TASK_STATUS,
    TITLE_RANKS,
    USER_TASK_ORIGIN,
    type MonitoringTaskKind,
    type TaskOrigin,
    type TaskStatus,
    type TitleRank,
} from "@monitor/kernel";
import { deriveTaskSlug } from "./task.slug.js";

const TITLE_RANK_ORDER: Readonly<Record<TitleRank, number>> = Object.fromEntries(
    TITLE_RANKS.map((rank, index) => [rank, index]),
) as Record<TitleRank, number>;

/** 태스크 읽기 모델의 상태와 원장 적용 순서를 관리한다. */
@Entity({ name: "tasks" })
@Index("tasks_user_updated", ["userId", "updatedAt"])
@Index("tasks_parent", ["parentTaskId"])
export class TaskEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ name: "title_rank", type: "text", default: AUTO_TITLE_RANK })
    titleRank!: TitleRank;

    @Column({ type: "text" })
    slug!: string;

    @Column({ name: "workspace_path", type: "text", nullable: true })
    workspacePath!: string | null;

    @Column({ type: "text" })
    status!: TaskStatus;

    @Column({ name: "task_kind", type: "text" })
    taskKind!: MonitoringTaskKind;

    @Column({ type: "text" })
    origin!: TaskOrigin;

    @Column({ name: "cli_source", type: "text", nullable: true })
    cliSource!: string | null;

    @Column({ name: "parent_task_id", type: "text", nullable: true })
    parentTaskId!: string | null;

    @Column({ name: "parent_session_id", type: "text", nullable: true })
    parentSessionId!: string | null;

    @Column({ name: "background_of_task_id", type: "text", nullable: true })
    backgroundOfTaskId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "last_session_started_at", type: "timestamptz", nullable: true })
    lastSessionStartedAt!: Date | null;

    @Column({ name: "last_event_at", type: "timestamptz", nullable: true })
    lastEventAt!: Date | null;

    @Column({ name: "last_applied_seq", type: "bigint", nullable: true })
    lastAppliedSeq!: string | null;

    applyLedgerStatusEffect(status: TaskStatus, at: Date, seq: string): boolean {
        if (this.isStaleSeq(seq)) return false;
        this.lastAppliedSeq = seq;
        const changed = this.status !== status;
        this.status = status;
        this.updatedAt = at;
        return changed;
    }

    forceStatus(status: TaskStatus, at: Date): boolean {
        const changed = this.status !== status;
        this.status = status;
        this.updatedAt = at;
        return changed;
    }

    /** 들어오는 제목의 순위가 저장된 순위보다 낮으면 무시하고, 그 이상이면 제목과 순위를 함께 갱신한다. */
    applyRankedTitle(title: string, rank: TitleRank, at: Date): boolean {
        if (TITLE_RANK_ORDER[rank] < TITLE_RANK_ORDER[this.titleRank]) return false;
        this.title = title;
        this.slug = deriveTaskSlug(title);
        this.titleRank = rank;
        this.updatedAt = at;
        return true;
    }

    isStaleSeq(seq: string): boolean {
        const applied = this.lastAppliedSeq ?? null;
        return applied !== null && BigInt(seq) <= BigInt(applied);
    }

    recordEventArrival(at: Date): void {
        if (this.lastEventAt === null || at.getTime() > this.lastEventAt.getTime()) {
            this.lastEventAt = at;
        }
    }

    recordSessionStart(at: Date): void {
        if (this.lastSessionStartedAt === null || at.getTime() > this.lastSessionStartedAt.getTime()) {
            this.lastSessionStartedAt = at;
        }
    }

    isCompleted(): boolean {
        return this.status === COMPLETED_TASK_STATUS;
    }

    isSessionRecipeScanAnchor(): boolean {
        return this.origin === USER_TASK_ORIGIN && this.parentTaskId === null;
    }

    isRecipeScanAnchor(): boolean {
        return this.isSessionRecipeScanAnchor() && this.isCompleted();
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }

    hasActivitySince(observedAt: Date | null): boolean {
        if (this.lastEventAt === null) return false;
        if (observedAt === null) return true;
        return this.lastEventAt.getTime() > observedAt.getTime();
    }
}
