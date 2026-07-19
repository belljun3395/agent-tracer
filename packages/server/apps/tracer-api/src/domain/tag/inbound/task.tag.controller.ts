import { BadRequestException, Body, Controller, Get, Headers, Put, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER, TASK_TAGS_PATH } from "@monitor/kernel";
import { SetTaskTagsUseCase } from "~tracer-api/domain/tag/application/command/set.task.tags.usecase.js";
import { GetTaskTagsUseCase } from "~tracer-api/domain/tag/application/query/get.task.tags.usecase.js";
import { GetTasksByTagUseCase } from "~tracer-api/domain/tag/application/query/get.tasks.by.tag.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { setTaskTagsSchema, taskTagsQuerySchema, type SetTaskTagsPayload, type TaskTagsQuery } from "./tag.schema.js";

/** 태스크와 태그의 부착 관계 조회·치환 HTTP 계약을 제공한다. */
@Controller(TASK_TAGS_PATH)
export class TaskTagController {
    constructor(
        private readonly getTaskTags: GetTaskTagsUseCase,
        private readonly getTasksByTag: GetTasksByTagUseCase,
        private readonly setTaskTags: SetTaskTagsUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(taskTagsQuerySchema)) query: TaskTagsQuery,
    ) {
        const userId = resolveUserId(user);
        if (query.taskId !== undefined) return this.getTaskTags.execute(userId, query.taskId);
        if (query.tagId !== undefined) return this.getTasksByTag.execute(userId, query.tagId);
        throw new BadRequestException("Exactly one of taskId or tagId is required");
    }

    @Put()
    async replace(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(setTaskTagsSchema)) body: SetTaskTagsPayload,
    ) {
        return this.setTaskTags.execute({ userId: resolveUserId(user), taskId: body.taskId, tagIds: body.tagIds });
    }
}
