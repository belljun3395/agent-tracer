import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, type ClockPort } from "~tracer-api/domain/tag/port/clock.port.js";
import { TAG_TRANSACTION, type TagTransactionPort, type TagTx } from "~tracer-api/domain/tag/port/tag.transaction.port.js";

@Injectable()
export class DeleteTagUseCase {
    constructor(
        @Inject(TAG_TRANSACTION)
        private readonly tx: TagTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly deleted: true }> {
        const now = this.clock.now();
        await this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
        return { deleted: true };
    }

    private async applyInTransaction(tx: TagTx, userId: string, id: string, now: Date): Promise<void> {
        const tag = await tx.tags.findById(id);
        // 남의 태그는 존재 여부도 드러내지 않는다.
        if (tag === null || tag.userId !== userId || tag.isDeleted()) {
            throw new NotFoundException("Tag not found");
        }

        tag.softDelete(now);
        await tx.tags.upsert(tag);
        // GitHub 라벨 삭제 의미론으로 이 태그가 붙어 있던 부착 행도 함께 걷어낸다.
        await tx.taskTags.deleteByTag(userId, id);
    }
}
