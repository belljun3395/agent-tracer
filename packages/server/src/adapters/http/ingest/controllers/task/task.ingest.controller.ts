import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import {
    CompleteTaskUseCase,
    ErrorTaskUseCase,
    LinkTaskUseCase,
    StartTaskUseCase,
} from "~application/tasks/index.js";
import type {
    CompleteTaskUseCaseIn,
    ErrorTaskUseCaseIn,
    LinkTaskUseCaseIn,
    StartTaskUseCaseIn,
} from "~application/tasks/index.js";
import {
    taskCompleteSchema,
    taskErrorSchema,
    taskLinkSchema,
    taskStartSchema,
} from "~adapters/http/ingest/schemas/task.ingest.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/tasks")
export class TaskIngestController {
    constructor(
        @Inject(StartTaskUseCase) private readonly startTask: StartTaskUseCase,
        @Inject(CompleteTaskUseCase) private readonly completeTask: CompleteTaskUseCase,
        @Inject(ErrorTaskUseCase) private readonly errorTask: ErrorTaskUseCase,
        @Inject(LinkTaskUseCase) private readonly linkTask: LinkTaskUseCase,
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
}
