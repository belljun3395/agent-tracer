import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TagEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/tag/port/clock.port.js";
import { TAG_TRANSACTION, type TagTransactionPort, type TagTx } from "~tracer-api/domain/tag/port/tag.transaction.port.js";
import { TagNameConflictError } from "~tracer-api/domain/tag/model/tag.errors.js";
import { mapTag, type TagDto } from "~tracer-api/domain/tag/model/tag.model.js";

export interface UpdateTagInput {
    readonly userId: string;
    readonly id: string;
    readonly name?: string;
    readonly color?: string;
    readonly description?: string | null;
}

@Injectable()
export class UpdateTagUseCase {
    constructor(
        @Inject(TAG_TRANSACTION)
        private readonly tx: TagTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: UpdateTagInput): Promise<{ readonly tag: TagDto }> {
        const now = this.clock.now();
        const tag = await this.tx.run((tx) => this.applyInTransaction(tx, input, now));
        return { tag: mapTag(tag) };
    }

    private async applyInTransaction(tx: TagTx, input: UpdateTagInput, now: Date): Promise<TagEntity> {
        const tag = await tx.tags.findById(input.id);
        // 남의 태그는 존재 여부도 드러내지 않는다.
        if (tag === null || tag.userId !== input.userId || tag.isDeleted()) {
            throw new NotFoundException("Tag not found");
        }

        if (input.name !== undefined && input.name !== tag.name) {
            const existing = await tx.tags.findByName(input.userId, input.name);
            if (existing !== null && existing.id !== tag.id) throw new TagNameConflictError(input.name);
        }

        tag.applyUpdate(
            {
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.color !== undefined ? { color: input.color } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
            },
            now,
        );
        await tx.tags.upsert(tag);
        return tag;
    }
}
