import type { TagTransactionPort, TagTx } from "~tracer-api/domain/tag/port/tag.transaction.port.js";
import { InMemoryTagRepository } from "./in-memory.tag.repository.js";
import { InMemoryTaskTagRepository } from "./in-memory.task.tag.repository.js";

/** 인메모리 대역 위에서 트랜잭션 경계를 재현해 실패 시 참여 저장소를 진입 시점으로 되돌린다. */
export class InMemoryTagTransaction implements TagTransactionPort {
    readonly tags = new InMemoryTagRepository();
    readonly taskTags = new InMemoryTaskTagRepository();

    async run<T>(work: (tx: TagTx) => Promise<T>): Promise<T> {
        const tags = this.tags.snapshot();
        const taskTags = this.taskTags.snapshot();
        try {
            return await work(this);
        } catch (error) {
            this.tags.restore(tags);
            this.taskTags.restore(taskTags);
            throw error;
        }
    }
}
