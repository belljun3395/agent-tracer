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
import { EndSessionUseCase, EnsureRuntimeSessionUseCase, EndRuntimeSessionUseCase } from "~application/sessions/index.js";
import type { EndSessionUseCaseIn } from "~application/sessions/index.js";
import {
    runtimeSessionEndSchema,
    runtimeSessionEnsureSchema,
    sessionEndSchema,
    taskCompleteSchema,
    taskErrorSchema,
    taskLinkSchema,
    taskPatchSchema,
    taskStartSchema,
} from "../schemas/task.write.schema.js";

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
        @Inject(EndSessionUseCase) private readonly endSession: EndSessionUseCase,
        @Inject(EnsureRuntimeSessionUseCase) private readonly ensureRuntimeSession: EnsureRuntimeSessionUseCase,
        @Inject(EndRuntimeSessionUseCase) private readonly endRuntimeSession: EndRuntimeSessionUseCase,
    ) {}

    @Post("/api/task-start")
    @HttpCode(HttpStatus.OK)
    async taskStart(@Body() body: unknown) {
        return this.startTask.execute(taskStartSchema.parse(body) as unknown as TaskStartInput);
    }

    @Post("/api/task-link")
    @HttpCode(HttpStatus.OK)
    async taskLink(@Body() body: unknown) {
        const task = await this.linkTask.execute(taskLinkSchema.parse(body) as unknown as TaskLinkInput);
        return { task };
    }

    @Post("/api/task-complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(@Body() body: unknown) {
        return this.completeTask.execute(taskCompleteSchema.parse(body) as unknown as TaskCompletionInput);
    }

    @Post("/api/task-error")
    @HttpCode(HttpStatus.OK)
    async taskError(@Body() body: unknown) {
        return this.errorTask.execute(taskErrorSchema.parse(body) as unknown as TaskErrorInput);
    }

    @Patch("/api/tasks/:taskId")
    async patchTask(@Param("taskId") taskId: string, @Body() body: unknown) {
        const parsed = taskPatchSchema.parse(body) as {
            title?: string;
            status?: "running" | "waiting" | "completed" | "errored";
        };
        const patchInput: TaskPatchInput = {
            taskId,
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(parsed.status !== undefined ? { status: parsed.status } : {}),
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

    @Post("/api/session-end")
    @HttpCode(HttpStatus.OK)
    async sessionEnd(@Body() body: unknown) {
        return this.endSession.execute(sessionEndSchema.parse(body) as unknown as EndSessionUseCaseIn);
    }

    @Post("/api/runtime-session-ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(@Body() body: unknown) {
        const parsed = runtimeSessionEnsureSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        return this.ensureRuntimeSession.execute(parsed.data as unknown as Parameters<EnsureRuntimeSessionUseCase["execute"]>[0]);
    }

    @Post("/api/runtime-session-end")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnd(@Body() body: unknown) {
        const parsed = runtimeSessionEndSchema.safeParse(body);
        if (!parsed.success) throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        await this.endRuntimeSession.execute({
            ...parsed.data,
            runtimeSource: parsed.data.runtimeSource.trim(),
            ...(parsed.data.backgroundCompletions
                ? { backgroundCompletions: parsed.data.backgroundCompletions.map((id) => id) }
                : {}),
        } as unknown as Parameters<EndRuntimeSessionUseCase["execute"]>[0]);
        return { ok: true };
    }
}
