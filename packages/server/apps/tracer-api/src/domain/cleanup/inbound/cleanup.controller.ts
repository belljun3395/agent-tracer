import { Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@monitor/kernel";
import { ListCleanupSuggestionsUseCase } from "~tracer-api/domain/cleanup/application/query/list.cleanup.suggestions.usecase.js";
import { AcceptCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { listQuerySchema, type ListQuery } from "./cleanup.schema.js";

/** 태스크 정리 제안의 조회·수락·기각 HTTP 계약을 제공한다. */
@Controller("api/v1/task-cleanup")
export class CleanupController {
    constructor(
        private readonly listSuggestions: ListCleanupSuggestionsUseCase,
        private readonly acceptSuggestion: AcceptCleanupSuggestionUseCase,
        private readonly dismissSuggestion: DismissCleanupSuggestionUseCase,
    ) {}

    @Get("suggestions")
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listSuggestions.execute(resolveUserId(user), query.status);
    }

    @Post("suggestions/:id/accept")
    @HttpCode(HttpStatus.OK)
    async accept(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.acceptSuggestion.execute(resolveUserId(user), id);
    }

    @Post("suggestions/:id/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismiss(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.dismissSuggestion.execute(resolveUserId(user), id);
    }
}
