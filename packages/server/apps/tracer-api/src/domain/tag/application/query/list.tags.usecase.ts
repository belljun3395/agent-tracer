import { Inject, Injectable } from "@nestjs/common";
import { TAG_REPOSITORY, type TagRepositoryPort } from "~tracer-api/domain/tag/port/tag.repository.port.js";
import { TASK_TAG_REPOSITORY, type TaskTagRepositoryPort } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";
import { mapTagSummary, type TagSummaryDto } from "~tracer-api/domain/tag/model/tag.model.js";

/** 이 사용자의 살아 있는 태그 전부를 태스크 부착 개수와 함께 준다. */
@Injectable()
export class ListTagsUseCase {
    constructor(
        @Inject(TAG_REPOSITORY)
        private readonly tags: TagRepositoryPort,
        @Inject(TASK_TAG_REPOSITORY)
        private readonly taskTags: TaskTagRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly items: readonly TagSummaryDto[] }> {
        const [rows, counts] = await Promise.all([this.tags.listAll(userId), this.taskTags.countByTag(userId)]);
        return { items: rows.map((tag) => mapTagSummary(tag, counts[tag.id] ?? 0)) };
    }
}
