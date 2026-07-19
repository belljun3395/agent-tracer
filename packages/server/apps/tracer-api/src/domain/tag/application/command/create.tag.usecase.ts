import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { TAG_DEFAULT_COLOR } from "@monitor/kernel";
import { TagEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/tag/port/clock.port.js";
import { TAG_TRANSACTION, type TagTransactionPort, type TagTx } from "~tracer-api/domain/tag/port/tag.transaction.port.js";
import { TagNameConflictError } from "~tracer-api/domain/tag/model/tag.errors.js";
import { mapTag, type TagDto } from "~tracer-api/domain/tag/model/tag.model.js";

export interface CreateTagInput {
    readonly userId: string;
    readonly name: string;
    readonly color?: string;
    readonly description?: string | null;
}

@Injectable()
export class CreateTagUseCase {
    constructor(
        @Inject(TAG_TRANSACTION)
        private readonly tx: TagTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: CreateTagInput): Promise<{ readonly tag: TagDto }> {
        const now = this.clock.now();
        const tag = await this.tx.run((tx) => this.applyInTransaction(tx, input, now));
        return { tag: mapTag(tag) };
    }

    private async applyInTransaction(tx: TagTx, input: CreateTagInput, now: Date): Promise<TagEntity> {
        const existing = await tx.tags.findByName(input.userId, input.name);
        if (existing !== null) throw new TagNameConflictError(input.name);

        const tag = TagEntity.create({
            id: generateUlid(now.getTime()),
            userId: input.userId,
            name: input.name,
            color: input.color ?? TAG_DEFAULT_COLOR,
            description: input.description ?? null,
            now,
        });
        await tx.tags.upsert(tag);
        return tag;
    }
}
