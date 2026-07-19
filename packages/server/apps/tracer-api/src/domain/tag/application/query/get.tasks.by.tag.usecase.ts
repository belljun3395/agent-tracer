import { Inject, Injectable } from "@nestjs/common";
import { TASK_TAG_REPOSITORY, type TaskTagRepositoryPort } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";

/** 이 태그가 붙은, 태그 기준으로 모아 보는 화면의 근거가 되는 태스크들의 id를 준다. */
@Injectable()
export class GetTasksByTagUseCase {
    constructor(
        @Inject(TASK_TAG_REPOSITORY)
        private readonly taskTags: TaskTagRepositoryPort,
    ) {}

    async execute(userId: string, tagId: string): Promise<{ readonly tagId: string; readonly taskIds: readonly string[] }> {
        const rows = await this.taskTags.findByTag(userId, tagId);
        return { tagId, taskIds: rows.map((row) => row.taskId) };
    }
}
