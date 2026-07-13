import { Controller, Get, Headers, NotFoundException, Param, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { GetTaskVerificationsUseCase } from "~tracer-api/domain/timeline/application/query/get.task.verifications.usecase.js";
import { GetTimelineUseCase } from "~tracer-api/domain/timeline/application/get.timeline.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { timelineQuerySchema, type TimelineQuery } from "./timeline.query.schema.js";

@Controller("api/v1/tasks")
export class TimelineController {
    constructor(
        private readonly getTimeline: GetTimelineUseCase,
        private readonly getTaskVerifications: GetTaskVerificationsUseCase,
    ) {}

    @Get(":taskId/timeline")
    async timeline(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
        @Query(new SchemaValidationPipe(timelineQuerySchema)) query: TimelineQuery,
    ) {
        const result = await this.getTimeline.execute({
            userId: resolveUserId(user),
            taskId,
            ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
        });
        if (result === null) throw new NotFoundException("Task not found");
        return result;
    }

    @Get(":taskId/verifications")
    async verifications(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        const result = await this.getTaskVerifications.execute(resolveUserId(user), taskId);
        if (result === null) throw new NotFoundException("Task not found");
        return { items: result };
    }
}
