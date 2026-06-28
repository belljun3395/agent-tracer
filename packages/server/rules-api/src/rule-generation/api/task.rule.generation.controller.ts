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
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../service/task.rule.generation.service.js";
import { EnqueueTaskRuleGenerationUseCase } from "../application/enqueue.task.rule.generation.usecase.js";
import { GetLatestTaskRuleGenerationUseCase } from "../application/get.latest.task.rule.generation.usecase.js";

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
            if (err instanceof MissingApiKeyError) {
                throw new BadRequestException(err.message);
            }
            throw err;
        }
    }

    @Get("latest")
    async latest(@Query("taskId", pathParamPipe) taskId: string) {
        return this.getLatestGeneration.execute(taskId);
    }
}
