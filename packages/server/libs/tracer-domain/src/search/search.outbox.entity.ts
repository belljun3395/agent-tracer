import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { SEARCH_OUTBOX_TARGET, type SearchOutboxTarget } from "./search.outbox.const.js";

export interface SearchOutboxEnqueueInput {
    readonly id: string;
    readonly userId: string;
    readonly target: SearchOutboxTarget;
    readonly targetId: string;
    readonly now: Date;
}

// 검색 인덱스 반영을 도메인 커밋과 같은 트랜잭션에 넣기 위한 아웃박스 행이며, OpenSearch 쓰기가 트랜잭션에 참여할 수 없어 행으로 남기고 배출자가 재시도한다.
@Entity({ name: "search_outbox" })
@Index("search_outbox_created", ["createdAt"])
export class SearchOutboxEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    target!: SearchOutboxTarget;

    @Column({ name: "target_id", type: "text" })
    targetId!: string;

    @Column({ name: "attempts", type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static enqueue(input: SearchOutboxEnqueueInput): SearchOutboxEntity {
        const row = new SearchOutboxEntity();
        row.id = input.id;
        row.userId = input.userId;
        row.target = input.target;
        row.targetId = input.targetId;
        row.attempts = 0;
        row.lastError = null;
        row.createdAt = input.now;
        return row;
    }

    isRecipe(): boolean {
        return this.target === SEARCH_OUTBOX_TARGET.recipe;
    }
}
