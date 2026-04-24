import { Controller, Post, Patch, Delete, Body, Param, HttpException, HttpStatus, HttpCode, Inject } from "@nestjs/common";
import {
    StartTaskUseCase,
    CompleteTaskUseCase,
    ErrorTaskUseCase,
    UpdateTaskUseCase,
    LinkTaskUseCase,
    DeleteTaskUseCase,
    DeleteFinishedTasksUseCase,
} from "~application/tasks/index.js";
import type { TaskStartInput, TaskLinkInput, TaskCompletionInput, TaskErrorInput, TaskPatchInput } from "~application/index.js";
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
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller()
export class LifecycleController {
    constructor(
        @Inject(StartTaskUseCase) private readonly startTask: StartTaskUseCase,
        @Inject(CompleteTaskUseCase) private readonly completeTask: CompleteTaskUseCase,
        @Inject(ErrorTaskUseCase) private readonly errorTask: ErrorTaskUseCase,
        @Inject(UpdateTaskUseCase) private readonly updateTask: UpdateTaskUseCase,
        @Inject(LinkTaskUseCase) private readonly linkTask: LinkTaskUseCase,
        @Inject(DeleteTaskUseCase) private readonly deleteTask: DeleteTaskUseCase,
        @Inject(DeleteFinishedTasksUseCase) private readonly deleteFinishedTasks: DeleteFinishedTasksUseCase,
        @Inject(EnsureRuntimeSessionUseCase) private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        @Inject(EndRuntimeSessionUseCase) private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    @Post("/api/task-start")
    @HttpCode(HttpStatus.OK)
    async taskStart(@Body(new ZodValidationPipe(taskStartSchema)) body: TaskStartInput) {
        return this.startTask.execute(body);
    }

    @Post("/api/task-link")
    @HttpCode(HttpStatus.OK)
    async taskLink(@Body(new ZodValidationPipe(taskLinkSchema)) body: TaskLinkInput) {
        const task = await this.linkTask.execute(body);
        return { task };
    }

    @Post("/api/task-complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(@Body(new ZodValidationPipe(taskCompleteSchema)) body: TaskCompletionInput) {
        return this.completeTask.execute(body);
    }

    @Post("/api/task-error")
    @HttpCode(HttpStatus.OK)
    async taskError(@Body(new ZodValidationPipe(taskErrorSchema)) body: TaskErrorInput) {
        return this.errorTask.execute(body);
    }

    @Patch("/api/tasks/:taskId")
    async patchTask(
        @Param("taskId") taskId: string,
        @Body(new ZodValidationPipe(taskPatchSchema)) body: Omit<TaskPatchInput, "taskId">,
    ) {
        const patchInput: TaskPatchInput = {
            taskId,
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
        };
        const task = await this.updateTask.execute(patchInput);
        if (!task) throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        return { task };
    }

    @Delete("/api/tasks/finished")
    async deleteFinished() {
        const deleted = await this.deleteFinishedTasks.execute();
        return { ok: true, deleted };
    }

    @Delete("/api/tasks/:taskId")
    async deleteTaskEndpoint(@Param("taskId") taskId: string) {
        const result = await this.deleteTask.execute(taskId);
        if (result === "not_found") throw new HttpException({ ok: false, error: "Task not found" }, HttpStatus.NOT_FOUND);
        return { ok: true };
    }

    @Post("/api/runtime-session-ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
        @Body(new ZodValidationPipe(runtimeSessionEnsureSchema))
        body: EnsureRuntimeSessionUseCaseIn,
    ) {
        return this.ensureRuntimeSession.execute(body);
    }

    @Post("/api/runtime-session-end")
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
        return { ok: true };
    }
}
