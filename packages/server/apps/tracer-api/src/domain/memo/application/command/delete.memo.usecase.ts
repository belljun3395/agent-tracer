import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { SEARCH_OUTBOX_TARGET, SearchOutboxEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/memo/port/clock.port.js";
import { MEMO_TRANSACTION, type MemoTransactionPort, type MemoTx } from "~tracer-api/domain/memo/port/memo.transaction.port.js";

@Injectable()
export class DeleteMemoUseCase {
    constructor(
        @Inject(MEMO_TRANSACTION)
        private readonly tx: MemoTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: true }> {
        const now = this.clock.now();
        await this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
        return { deleted: true };
    }

    private async applyInTransaction(tx: MemoTx, userId: string, id: string, now: Date): Promise<void> {
        const memo = await tx.memos.findById(id);
        // 남의 메모는 존재 여부도 드러내지 않는다.
        if (memo === null || memo.userId !== userId || memo.isDeleted()) {
            throw new NotFoundException("Memo not found");
        }

        memo.softDelete(now);
        await tx.memos.upsert(memo);
        // 배출기가 isDeleted()를 보고 검색 문서를 지운다.
        await tx.searchOutbox.enqueue(
            SearchOutboxEntity.enqueue({
                id: generateUlid(now.getTime()),
                userId,
                target: SEARCH_OUTBOX_TARGET.memo,
                targetId: memo.id,
                now,
            }),
        );
    }
}
