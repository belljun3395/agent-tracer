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
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { AcceptCleanupSuggestionUseCase } from "../application/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "../application/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "../application/list.cleanup.suggestions.usecase.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    NoTasksToScanError,
    TaskCleanupService,
} from "../application/task.cleanup.service.js";
import type { CleanupSuggestionStatusFilter } from "../application/dto/cleanup.usecase.dto.js";

@Controller("api/v1/task-cleanup")
export class TaskCleanupController {
    constructor(
        @Inject(TaskCleanupService)
        private readonly service: TaskCleanupService,
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
            const job = await this.service.enqueue();
            return {
                jobId: job.id,
                status: job.status,
                createdAt: job.createdAt,
            };
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
        const job = await this.service.findLatest();
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                suggestionsCreated: job.suggestionsCreated,
                tasksScanned: job.tasksScanned,
                modelUsed: job.modelUsed,
                durationMs: job.durationMs,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            },
        };
    }

    @Get("suggestions")
    async list(@Query("status") statusParam?: string) {
        let status: CleanupSuggestionStatusFilter = "pending";
        if (statusParam !== undefined) {
            if (statusParam !== "pending" && statusParam !== "all") {
                throw new BadRequestException("status must be 'pending' or 'all'");
            }
            status = statusParam;
        }
        return this.listSuggestions.execute({ status });
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
