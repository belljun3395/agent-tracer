import {
    BadRequestException,
    ConflictException,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Inject,
    NotFoundException,
    Param,
    Post,
    Query,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { AcceptCleanupSuggestionUseCase } from "../application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "../application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "../application/list.cleanup.suggestions.usecase.js";
import { EnqueueTaskCleanupUseCase } from "../application/enqueue.task.cleanup.usecase.js";
import { GetLatestTaskCleanupUseCase } from "../application/get.latest.task.cleanup.usecase.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    NoTasksToScanError,
} from "../domain/task.cleanup.errors.js";
import { parseCleanupSuggestionStatusFilter } from "./cleanup.query.filters.js";

@Controller("api/v1/task-cleanup")
export class TaskCleanupController {
    constructor(
        @Inject(EnqueueTaskCleanupUseCase)
        private readonly enqueueCleanup: EnqueueTaskCleanupUseCase,
        @Inject(GetLatestTaskCleanupUseCase)
        private readonly getLatestCleanup: GetLatestTaskCleanupUseCase,
        @Inject(ListCleanupSuggestionsUseCase)
        private readonly listSuggestions: ListCleanupSuggestionsUseCase,
        @Inject(AcceptCleanupSuggestionUseCase)
        private readonly accept: AcceptCleanupSuggestionUseCase,
        @Inject(DismissCleanupSuggestionUseCase)
        private readonly dismiss: DismissCleanupSuggestionUseCase,
    ) {}

    @Post("jobs")
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue() {
        try {
            return await this.enqueueCleanup.execute();
        } catch (err) {
            if (err instanceof GenerationAlreadyInFlightError) {
                throw new ConflictException({
                    message: err.message,
                    jobId: err.jobId,
                });
            }
            if (err instanceof MissingApiKeyError) {
                throw new BadRequestException(err.message);
            }
            if (err instanceof NoTasksToScanError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Get("jobs/latest")
    async latest() {
        return this.getLatestCleanup.execute();
    }

    @Get("suggestions")
    async list(@Query("status") statusParam?: string) {
        return this.listSuggestions.execute({
            status: parseCleanupSuggestionStatusFilter(statusParam),
        });
    }

    @Post("suggestions/:suggestionId/accept")
    @HttpCode(HttpStatus.OK)
    async acceptSuggestion(
        @Param("suggestionId", pathParamPipe) suggestionId: string,
    ) {
        const result = await this.accept.execute({ suggestionId });
        if (result.status === "not_found") {
            throw new NotFoundException("Suggestion not found");
        }
        if (result.status === "not_pending") {
            throw new ConflictException("Suggestion is no longer pending");
        }
        if (result.status === "apply_failed") {
            throw new BadRequestException({
                message: "Failed to apply suggestion",
                error: result.error,
            });
        }
        return { status: result.status };
    }

    @Post("suggestions/:suggestionId/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismissSuggestion(
        @Param("suggestionId", pathParamPipe) suggestionId: string,
    ) {
        const result = await this.dismiss.execute({ suggestionId });
        if (result.status === "not_found") {
            throw new NotFoundException("Suggestion not found");
        }
        if (result.status === "not_pending") {
            throw new ConflictException("Suggestion is no longer pending");
        }
        return { status: result.status };
    }
}
