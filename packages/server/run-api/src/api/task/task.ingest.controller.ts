import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { CompleteTaskUseCase } from "../../application/task/complete.task.usecase.js";
import { ErrorTaskUseCase } from "../../application/task/error.task.usecase.js";
import { GetTaskSummaryUseCase } from "../../application/task/get.task.summary.usecase.js";
import { LinkTaskUseCase } from "../../application/task/link.task.usecase.js";
import { ListTasksUseCase } from "../../application/task/list.tasks.usecase.js";
import { StartTaskUseCase } from "../../application/task/start.task.usecase.js";
import type { CompleteTaskUseCaseIn } from "../../application/task/dto/complete.task.usecase.dto.js";
import type { ErrorTaskUseCaseIn } from "../../application/task/dto/error.task.usecase.dto.js";
import type { LinkTaskUseCaseIn } from "../../application/task/dto/link.task.usecase.dto.js";
import type { StartTaskUseCaseIn } from "../../application/task/dto/start.task.usecase.dto.js";
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
