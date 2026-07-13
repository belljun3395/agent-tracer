import { Controller, Get, Headers, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { SearchTasksUseCase } from "~tracer-api/domain/search/application/search.tasks.usecase.js";
import { SearchEventsUseCase } from "~tracer-api/domain/search/application/search.events.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import {
    eventSearchQuerySchema,
    taskSearchQuerySchema,
    type EventSearchQuery,
    type TaskSearchQuery,
} from "./search.schema.js";

@Controller("api/v1")
export class SearchController {
    constructor(
        private readonly searchTasks: SearchTasksUseCase,
        private readonly searchEvents: SearchEventsUseCase,
    ) {}

    @Get("tasks/search")
    async tasksSearch(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(taskSearchQuerySchema)) query: TaskSearchQuery,
    ) {
        return this.searchTasks.execute({
            userId: resolveUserId(user),
            q: query.q ?? "",
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
        });
    }

    @Get("events/search")
    async eventsSearch(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(eventSearchQuerySchema)) query: EventSearchQuery,
    ) {
        return this.searchEvents.execute({
            userId: resolveUserId(user),
            ...(query.q !== undefined ? { q: query.q } : {}),
            ...(query.taskId !== undefined ? { taskId: query.taskId } : {}),
            ...(query.kind !== undefined ? { kind: query.kind } : {}),
            ...(query.lane !== undefined ? { lane: query.lane } : {}),
            ...(query.from !== undefined ? { from: query.from } : {}),
            ...(query.to !== undefined ? { to: query.to } : {}),
            ...(query.limit !== undefined ? { limit: query.limit } : {}),
        });
    }
}
