import { Controller, Get, Headers, NotFoundException, Param, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { GetTaskUseCase } from "~tracer-api/domain/task/application/query/get.task.usecase.js";
import { ListChildTasksUseCase } from "~tracer-api/domain/task/application/query/list.child.tasks.usecase.js";
import { ListTasksUseCase } from "~tracer-api/domain/task/application/query/list.tasks.usecase.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { listQuerySchema, type ListQuery } from "./task.query.schema.js";

/** 태스크 목록·상세·계층 조회 HTTP 계약을 제공한다. */
@Controller("api/v1/tasks")
export class TaskQueryController {
    constructor(
        private readonly listTasks: ListTasksUseCase,
        private readonly getTask: GetTaskUseCase,
        private readonly listChildTasks: ListChildTasksUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listTasks.execute({
            userId: resolveUserId(user),
            ...(query.status !== undefined ? { status: query.status } : {}),
            ...(query.origin !== undefined ? { origin: query.origin } : {}),
            ...(query.archived !== undefined ? { archived: query.archived === "true" } : {}),
            ...(query.root !== undefined ? { rootOnly: query.root === "true" } : {}),
            ...(query.parentTaskId !== undefined ? { parentTaskId: query.parentTaskId } : {}),
            ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
        });
    }

    @Get(":taskId/children")
    async children(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        const result = await this.listChildTasks.execute(resolveUserId(user), taskId);
        if (result === null) throw new NotFoundException("Task not found");
        return result;
    }

    @Get(":taskId")
    async get(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("taskId", pathParamPipe) taskId: string,
    ) {
        const detail = await this.getTask.execute(resolveUserId(user), taskId);
        if (detail === null) throw new NotFoundException("Task not found");
        return detail;
    }
}
