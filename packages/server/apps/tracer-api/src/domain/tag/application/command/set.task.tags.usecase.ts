import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { TagEntity, TaskTagEntity } from "@monitor/tracer-domain";
import { CLOCK, type ClockPort } from "~tracer-api/domain/tag/port/clock.port.js";
import { TAG_TRANSACTION, type TagTransactionPort, type TagTx } from "~tracer-api/domain/tag/port/tag.transaction.port.js";
import { mapTag, type TagDto } from "~tracer-api/domain/tag/model/tag.model.js";

export interface SetTaskTagsInput {
    readonly userId: string;
    readonly taskId: string;
    readonly tagIds: readonly string[];
}

export interface TaskTagsResult {
    readonly taskId: string;
    readonly tags: readonly TagDto[];
}

/** 태스크에 붙은 태그를 통째로 치환하는 set 의미론이며, 같은 목록을 다시 보내도 부착 행이 늘지 않는다. */
@Injectable()
export class SetTaskTagsUseCase {
    constructor(
        @Inject(TAG_TRANSACTION)
        private readonly tx: TagTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SetTaskTagsInput): Promise<TaskTagsResult> {
        const now = this.clock.now();
        return this.tx.run((tx) => this.applyInTransaction(tx, input, now));
    }

    private async applyInTransaction(tx: TagTx, input: SetTaskTagsInput, now: Date): Promise<TaskTagsResult> {
        const uniqueIds = [...new Set(input.tagIds)];
        const owned = await tx.tags.findByIds(input.userId, uniqueIds);
        if (owned.length !== uniqueIds.length) {
            throw new NotFoundException("One or more tags not found");
        }
        const ownedById = new Map(owned.map((tag) => [tag.id, tag] as const));

        const current = await tx.taskTags.findByTask(input.userId, input.taskId);
        const currentTagIds = new Set(current.map((row) => row.tagId));
        const desiredTagIds = new Set(uniqueIds);

        const toAdd = uniqueIds.filter((id) => !currentTagIds.has(id));
        const toRemove = current.map((row) => row.tagId).filter((id) => !desiredTagIds.has(id));

        if (toRemove.length > 0) {
            await tx.taskTags.deleteByTaskAndTags(input.userId, input.taskId, toRemove);
        }
        if (toAdd.length > 0) {
            await tx.taskTags.insertMany(
                toAdd.map((tagId) =>
                    TaskTagEntity.create({
                        id: generateUlid(now.getTime()),
                        userId: input.userId,
                        taskId: input.taskId,
                        tagId,
                        now,
                    }),
                ),
            );
        }

        return {
            taskId: input.taskId,
            tags: uniqueIds
                .map((id) => ownedById.get(id))
                .filter((tag): tag is TagEntity => tag !== undefined)
                .map(mapTag),
        };
    }
}
