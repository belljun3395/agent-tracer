import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import {
    StartTaskUseCase,
    CompleteTaskUseCase,
    ErrorTaskUseCase,
    UpdateTaskUseCase,
    LinkTaskUseCase,
    DeleteTaskUseCase,
    DeleteFinishedTasksUseCase,
} from "~application/tasks/index.js";
import type {
    CompleteTaskUseCaseIn,
    ErrorTaskUseCaseIn,
    LinkTaskUseCaseIn,
    StartTaskUseCaseIn,
    UpdateTaskUseCaseIn,
} from "~application/tasks/index.js";
import {
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
    type EnsureRuntimeSessionUseCaseIn,
    type EndRuntimeSessionUseCaseIn,
} from "~application/sessions/index.js";
import {
    runtimeSessionEndSchema,
    runtimeSessionEnsureSchema,
    taskCompleteSchema,
    taskErrorSchema,
    taskLinkSchema,
    taskPatchSchema,
    taskStartSchema,
} from "../schemas/task.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api")
export class TaskLifecycleController {
    constructor(
        @Inject(StartTaskUseCase) private readonly startTask: StartTaskUseCase,
        @Inject(CompleteTaskUseCase) private readonly completeTask: CompleteTaskUseCase,
        @Inject(ErrorTaskUseCase) private readonly errorTask: ErrorTaskUseCase,
        @Inject(UpdateTaskUseCase) private readonly updateTask: UpdateTaskUseCase,
        @Inject(LinkTaskUseCase) private readonly linkTask: LinkTaskUseCase,
        @Inject(DeleteTaskUseCase) private readonly deleteTask: DeleteTaskUseCase,
        @Inject(DeleteFinishedTasksUseCase) private readonly deleteFinishedTasks: DeleteFinishedTasksUseCase,
    ) {}

    @Post("task-start")
    @HttpCode(HttpStatus.OK)
    async taskStart(@Body(new ZodValidationPipe(taskStartSchema)) body: StartTaskUseCaseIn) {
        return this.startTask.execute(body);
    }

    @Post("task-link")
    @HttpCode(HttpStatus.OK)
    async taskLink(@Body(new ZodValidationPipe(taskLinkSchema)) body: LinkTaskUseCaseIn) {
        const task = await this.linkTask.execute(body);
        return { task };
    }

    @Post("task-complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(@Body(new ZodValidationPipe(taskCompleteSchema)) body: CompleteTaskUseCaseIn) {
        return this.completeTask.execute(body);
    }

    @Post("task-error")
    @HttpCode(HttpStatus.OK)
    async taskError(@Body(new ZodValidationPipe(taskErrorSchema)) body: ErrorTaskUseCaseIn) {
        return this.errorTask.execute(body);
    }

    @Patch("tasks/:taskId")
    async patchTask(
        @Param("taskId", pathParamPipe) taskId: string,
        @Body(new ZodValidationPipe(taskPatchSchema)) body: Omit<UpdateTaskUseCaseIn, "taskId">,
    ) {
        const patchInput: UpdateTaskUseCaseIn = {
            taskId,
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
        };
        const task = await this.updateTask.execute(patchInput);
        if (!task) throw new NotFoundException("Task not found");
        return { task };
    }

    @Delete("tasks/finished")
    async deleteFinished() {
        const { count } = await this.deleteFinishedTasks.execute({});
        return { deleted: count };
    }

    @Delete("tasks/:taskId")
    async deleteTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const result = await this.deleteTask.execute({ taskId });
        if (result.status === "not_found") throw new NotFoundException("Task not found");
        return { deleted: true };
    }
}

@Controller("api")
export class RuntimeSessionController {
    constructor(
        @Inject(EnsureRuntimeSessionUseCase) private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        @Inject(EndRuntimeSessionUseCase) private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    @Post("runtime-session-ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
        @Body(new ZodValidationPipe(runtimeSessionEnsureSchema))
        body: EnsureRuntimeSessionUseCaseIn,
    ) {
        return this.ensureRuntimeSession.execute(body);
    }

    @Post("runtime-session-end")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnd(
        @Body(new ZodValidationPipe(runtimeSessionEndSchema))
        body: EndRuntimeSessionUseCaseIn,
    ) {
        await this.endRuntimeSession.execute({
            ...body,
            runtimeSource: body.runtimeSource.trim(),
            ...(body.backgroundCompletions
                ? { backgroundCompletions: body.backgroundCompletions.map((id) => id) }
                : {}),
        });
        return { ended: true };
    }
}
