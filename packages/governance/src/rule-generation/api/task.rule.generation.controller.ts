import {
    BadRequestException,
    ConflictException,
    Controller,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Get,
    Inject,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/contracts/http/path-param.pipe.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
    TaskRuleGenerationService,
} from "../application/task.rule.generation.service.js";

@Controller("api/v1/tasks/:taskId/generate-rules")
export class TaskRuleGenerationController {
    constructor(
        @Inject(TaskRuleGenerationService)
        private readonly service: TaskRuleGenerationService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(@Param("taskId", pathParamPipe) taskId: string) {
        try {
            const job = await this.service.run(taskId);
            return {
                jobId: job.id,
                status: job.status,
                taskId: job.taskId,
                createdAt: job.createdAt,
            };
        } catch (err) {
            if (err instanceof TaskNotFoundForGenerationError) {
                throw new NotFoundException(err.message);
            }
            if (err instanceof TaskHasNoEventsError) {
                throw new BadRequestException(err.message);
            }
            if (err instanceof GenerationAlreadyInFlightError) {
                throw new ConflictException({ message: err.message, jobId: err.jobId });
            }
            if (err instanceof MissingApiKeyError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Get("latest")
    async latest(@Param("taskId", pathParamPipe) taskId: string) {
        const job = await this.service.findLatest(taskId);
        if (!job) return { job: null };
        return {
            job: {
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                error: job.error,
                rulesCreated: job.rulesCreated ?? 0,
                modelUsed: job.modelUsed,
                durationMs: job.durationMs,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            },
        };
    }
}
