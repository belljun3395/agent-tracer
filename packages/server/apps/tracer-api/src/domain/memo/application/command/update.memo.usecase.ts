import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { SEARCH_OUTBOX_TARGET, SearchOutboxEntity, type MemoEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/memo/port/clock.port.js";
import { MEMO_TRANSACTION, type MemoTransactionPort, type MemoTx } from "~tracer-api/domain/memo/port/memo.transaction.port.js";
import { mapMemo, type MemoDto } from "~tracer-api/domain/memo/model/memo.model.js";

export interface UpdateMemoInput {
    readonly userId: string;
    readonly id: string;
    readonly body: string;
}

@Injectable()
export class UpdateMemoUseCase {
    constructor(
        @Inject(MEMO_TRANSACTION)
        private readonly tx: MemoTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: UpdateMemoInput): Promise<{ readonly memo: MemoDto }> {
        const now = this.clock.now();
        const memo = await this.tx.run((tx) => this.applyInTransaction(tx, input, now));
        return { memo: mapMemo(memo) };
    }

    private async applyInTransaction(tx: MemoTx, input: UpdateMemoInput, now: Date): Promise<MemoEntity> {
        const memo = await tx.memos.findById(input.id);
        // 남의 메모는 존재 여부도 드러내지 않는다.
        if (memo === null || memo.userId !== input.userId || memo.isDeleted()) {
            throw new NotFoundException("Memo not found");
        }

        memo.body = input.body;
        memo.markEditedByUser(now);
        await tx.memos.upsert(memo);
        await tx.searchOutbox.enqueue(
            SearchOutboxEntity.enqueue({
                id: generateUlid(now.getTime()),
                userId: input.userId,
                target: SEARCH_OUTBOX_TARGET.memo,
                targetId: memo.id,
                now,
            }),
        );
        return memo;
    }
}
