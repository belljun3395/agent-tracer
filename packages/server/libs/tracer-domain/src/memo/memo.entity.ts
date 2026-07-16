import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { MEMO_AUTHOR, type MemoAuthor } from "@monitor/kernel";

export interface MemoCreateInput {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string;
    /** null이면 태스크 메모, 값이 있으면 그 이벤트에 매달린 메모다. */
    readonly eventId: string | null;
    readonly body: string;
    readonly author: MemoAuthor;
    readonly now: Date;
}

// 메모는 쓰레드라 유니크 제약 없이 같은 태스크·이벤트에 여러 행이 쌓인다.
@Entity({ name: "memos" })
@Index("memos_user_task", ["userId", "taskId"])
@Index("memos_event", ["eventId"], { where: '"event_id" IS NOT NULL AND "deleted_at" IS NULL' })
@Index("memos_live_user_task", ["userId", "taskId"], { where: '"deleted_at" IS NULL' })
export class MemoEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "event_id", type: "text", nullable: true })
    eventId!: string | null;

    @Column({ type: "text" })
    body!: string;

    @Column({ type: "text" })
    author!: MemoAuthor;

    @Column({ name: "last_edited_by", type: "text" })
    lastEditedBy!: MemoAuthor;

    @Column({ type: "integer", default: 1 })
    rev!: number;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
    deletedAt!: Date | null;

    static create(input: MemoCreateInput): MemoEntity {
        const memo = new MemoEntity();
        memo.id = input.id;
        memo.userId = input.userId;
        memo.taskId = input.taskId;
        memo.eventId = input.eventId;
        memo.body = input.body;
        memo.author = input.author;
        memo.lastEditedBy = input.author;
        memo.rev = 1;
        memo.createdAt = input.now;
        memo.updatedAt = input.now;
        memo.deletedAt = null;
        return memo;
    }

    markEditedByUser(now: Date): void {
        this.rev += 1;
        this.lastEditedBy = MEMO_AUTHOR.human;
        this.updatedAt = now;
    }

    softDelete(now: Date): void {
        this.deletedAt = now;
        this.updatedAt = now;
    }

    isDeleted(): boolean {
        return this.deletedAt !== null;
    }
}
