import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import {
    StartTaskUseCase,
    CompleteTaskUseCase,
    ErrorTaskUseCase,
    LinkTaskUseCase,
} from "~application/tasks/index.js";
import type { TaskStartInput, TaskLinkInput, TaskCompletionInput, TaskErrorInput } from "~application/tasks/index.js";
import {
    taskCompleteSchema,
    taskErrorSchema,
    taskLinkSchema,
    taskStartSchema,
} from "~adapters/http/ingest/schemas/task.write.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("ingest/v1/tasks")
export class TaskIngestController {
    constructor(
        @Inject(StartTaskUseCase) private readonly startTask: StartTaskUseCase,
        @Inject(CompleteTaskUseCase) private readonly completeTask: CompleteTaskUseCase,
        @Inject(ErrorTaskUseCase) private readonly errorTask: ErrorTaskUseCase,
        @Inject(LinkTaskUseCase) private readonly linkTask: LinkTaskUseCase,
    ) {}

    // creates a new monitoring task
    @Post("start")
    @HttpCode(HttpStatus.OK)
    async taskStart(@Body(new ZodValidationPipe(taskStartSchema)) body: TaskStartInput) {
        return this.startTask.execute(body);
    }

    // links a subagent task to a parent task
    @Post("link")
    @HttpCode(HttpStatus.OK)
    async taskLink(@Body(new ZodValidationPipe(taskLinkSchema)) body: TaskLinkInput) {
        const task = await this.linkTask.execute(body);
        return { task };
    }

    // marks a task as completed
    @Post("complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(@Body(new ZodValidationPipe(taskCompleteSchema)) body: TaskCompletionInput) {
        return this.completeTask.execute(body);
    }

    // records a task failure
    @Post("error")
    @HttpCode(HttpStatus.OK)
    async taskError(@Body(new ZodValidationPipe(taskErrorSchema)) body: TaskErrorInput) {
        return this.errorTask.execute(body);
    }
}
