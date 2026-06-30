import {
    BadRequestException,
    ConflictException,
    Controller,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Query,
    Post,
    Get,
} from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import {
    GenerationAlreadyInFlightError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../../domain/generation/task.rule.generation.errors.js";
import { EnqueueTaskRuleGenerationUseCase } from "../../application/generation/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "../../application/generation/get.latest.task.rule.generation.usecase.js";

@Controller("api/v1/rules/generate")
export class TaskRuleGenerationController {
    constructor(
        private readonly enqueueGeneration: EnqueueTaskRuleGenerationUseCase,
        private readonly getLatestGeneration: GetLatestTaskRuleGenerationUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(@Query("taskId", pathParamPipe) taskId: string) {
        try {
            return await this.enqueueGeneration.execute(taskId);
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
            throw err;
        }
    }

    @Get("latest")
    async latest(@Query("taskId", pathParamPipe) taskId: string) {
        return this.getLatestGeneration.execute(taskId);
    }
}
