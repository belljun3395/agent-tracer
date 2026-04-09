import { Controller, Post, Patch, Delete, Body, Param, HttpException, HttpStatus, HttpCode } from "@nestjs/common";
import { RuntimeSource, RuntimeSessionId, TaskId } from "@monitor/core";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";
import type { TaskStartInput, TaskLinkInput, TaskCompletionInput, TaskErrorInput, TaskPatchInput, TaskSessionEndInput, RuntimeSessionEnsureInput, RuntimeSessionEndInput } from "../../../application/types.js";
import { taskStartSchema, taskLinkSchema, taskCompleteSchema, taskErrorSchema, taskPatchSchema, sessionEndSchema, runtimeSessionEnsureSchema, runtimeSessionEndSchema } from "../../schemas.js";
@Controller()
export class LifecycleController {
    constructor(private readonly service: MonitorServiceProvider) { }
    @Post("/api/task-start")
    @HttpCode(HttpStatus.OK)
    async taskStart(
    @Body()
    body: unknown) {
        return this.service.startTask(taskStartSchema.parse(body) as unknown as TaskStartInput);
    }
    @Post("/api/task-link")
    @HttpCode(HttpStatus.OK)
    async taskLink(
    @Body()
    body: unknown) {
        const task = await this.service.linkTask(taskLinkSchema.parse(body) as unknown as TaskLinkInput);
        return { task };
    }
    @Post("/api/task-complete")
    @HttpCode(HttpStatus.OK)
    async taskComplete(
    @Body()
    body: unknown) {
        return this.service.completeTask(taskCompleteSchema.parse(body) as unknown as TaskCompletionInput);
    }
    @Post("/api/task-error")
    @HttpCode(HttpStatus.OK)
    async taskError(
    @Body()
    body: unknown) {
        return this.service.errorTask(taskErrorSchema.parse(body) as unknown as TaskErrorInput);
    }
    @Patch("/api/tasks/:taskId")
    async patchTask(
    @Param("taskId")
    taskId: string, 
    @Body()
    body: unknown) {
        const parsed = taskPatchSchema.parse(body) as {
            title?: string;
            status?: "running" | "waiting" | "completed" | "errored";
        };
        const patchInput: TaskPatchInput = {
            taskId: TaskId(taskId),
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(parsed.status !== undefined ? { status: parsed.status } : {})
        };
        const task = await this.service.updateTask(patchInput);
        if (!task) {
            throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        }
        return { task };
    }
    @Delete("/api/tasks/finished")
    async deleteFinished() {
        const deleted = await this.service.deleteFinishedTasks();
        return { ok: true, deleted };
    }
    @Delete("/api/tasks/:taskId")
    async deleteTask(
    @Param("taskId")
    taskId: string) {
        const result = await this.service.deleteTask(TaskId(taskId));
        if (result === "not_found") {
            throw new HttpException({ ok: false, error: "Task not found" }, HttpStatus.NOT_FOUND);
        }
        return { ok: true };
    }
    @Post("/api/session-end")
    @HttpCode(HttpStatus.OK)
    async sessionEnd(
    @Body()
    body: unknown) {
        return this.service.endSession(sessionEndSchema.parse(body) as unknown as TaskSessionEndInput);
    }
    @Post("/api/runtime-session-ensure")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnsure(
    @Body()
    body: unknown) {
        const parsed = runtimeSessionEnsureSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        }
        return this.service.ensureRuntimeSession(parsed.data as unknown as RuntimeSessionEnsureInput);
    }
    @Post("/api/runtime-session-end")
    @HttpCode(HttpStatus.OK)
    async runtimeSessionEnd(
    @Body()
    body: unknown) {
        const parsed = runtimeSessionEndSchema.safeParse(body);
        if (!parsed.success) {
            throw new HttpException({ error: parsed.error.format() }, HttpStatus.BAD_REQUEST);
        }
        await this.service.endRuntimeSession({
            ...parsed.data,
            runtimeSource: RuntimeSource(parsed.data.runtimeSource),
            runtimeSessionId: RuntimeSessionId(parsed.data.runtimeSessionId),
            ...(parsed.data.backgroundCompletions
                ? { backgroundCompletions: parsed.data.backgroundCompletions.map((id) => TaskId(id)) }
                : {})
        } as unknown as RuntimeSessionEndInput);
        return { ok: true };
    }
}
