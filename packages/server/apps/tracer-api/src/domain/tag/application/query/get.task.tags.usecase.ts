import { Inject, Injectable } from "@nestjs/common";
import type { TagEntity } from "@monitor/tracer-domain";
import { TAG_REPOSITORY, type TagRepositoryPort } from "~tracer-api/domain/tag/port/tag.repository.port.js";
import { TASK_TAG_REPOSITORY, type TaskTagRepositoryPort } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";
import { mapTag, type TagDto } from "~tracer-api/domain/tag/model/tag.model.js";

/** 태스크 하나에 붙은 태그들을 준다. */
@Injectable()
export class GetTaskTagsUseCase {
    constructor(
        @Inject(TAG_REPOSITORY)
        private readonly tags: TagRepositoryPort,
        @Inject(TASK_TAG_REPOSITORY)
        private readonly taskTags: TaskTagRepositoryPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<{ readonly taskId: string; readonly tags: readonly TagDto[] }> {
        const rows = await this.taskTags.findByTask(userId, taskId);
        const tagIds = rows.map((row) => row.tagId);
        const owned = await this.tags.findByIds(userId, tagIds);
        const ownedById = new Map(owned.map((tag) => [tag.id, tag] as const));

        return {
            taskId,
            tags: tagIds
                .map((id) => ownedById.get(id))
                .filter((tag): tag is TagEntity => tag !== undefined)
                .map(mapTag),
        };
    }
}
