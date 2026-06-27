import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { pathParamPipe } from "@monitor/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/contracts/http/zod-validation.pipe.js";
import { CompleteTaskUseCase } from "../application/complete.task.usecase.js";
import { ErrorTaskUseCase } from "../application/error.task.usecase.js";
import { GetTaskSummaryUseCase } from "../application/get.task.summary.usecase.js";
import { LinkTaskUseCase } from "../application/link.task.usecase.js";
import { ListTasksUseCase } from "../application/list.tasks.usecase.js";
import { StartTaskUseCase } from "../application/start.task.usecase.js";
import type { CompleteTaskUseCaseIn } from "../application/dto/complete.task.usecase.dto.js";
import type { ErrorTaskUseCaseIn } from "../application/dto/error.task.usecase.dto.js";
import type { LinkTaskUseCaseIn } from "../application/dto/link.task.usecase.dto.js";
import type { StartTaskUseCaseIn } from "../application/dto/start.task.usecase.dto.js";
import {
    taskCompleteSchema,
    taskErrorSchema,
    taskLinkSchema,
    taskStartSchema,
} from "./task.ingest.schema.js";

@Controller("ingest/v1/tasks")
export class TaskIngestController {
    constructor(
        private readonly startTask: StartTaskUseCase,
        private readonly completeTask: CompleteTaskUseCase,
        private readonly errorTask: ErrorTaskUseCase,
        private readonly linkTask: LinkTaskUseCase,
        private readonly listTasks: ListTasksUseCase,
        private readonly getTaskSummary: GetTaskSummaryUseCase,
    ) {}

    @Post("start")
    @HttpCode(HttpStatus.OK)
    async taskStart(@Body(new ZodValidationPipe(taskStartSchema)) body: StartTaskUseCaseIn) {
        return this.startTask.execute(body);
    }

    @Post("link")
    @HttpCode(HttpStatus.OK)
    async taskLink(@Body(new ZodValidationPipe(taskLinkSchema)) body: LinkTaskUseCaseIn) {
        const task = await this.linkTask.execute(body);
        return { task };
    }

    @Post("complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(@Body(new ZodValidationPipe(taskCompleteSchema)) body: CompleteTaskUseCaseIn) {
        return this.completeTask.execute(body);
    }

    @Post("error")
    @HttpCode(HttpStatus.OK)
    async taskError(@Body(new ZodValidationPipe(taskErrorSchema)) body: ErrorTaskUseCaseIn) {
        return this.errorTask.execute(body);
    }

    @Get()
    async listTasksEndpoint() {
        return this.listTasks.execute({});
    }

    @Get(":taskId/summary")
    async taskSummary(@Param("taskId", pathParamPipe) taskId: string) {
        const { summary } = await this.getTaskSummary.execute({ taskId });
        if (!summary) throw new NotFoundException("Task not found");
        return { summary };
    }
}
