import { Controller, Get, Param, HttpException, HttpStatus } from "@nestjs/common";
import { TaskId } from "@monitor/core";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";
@Controller()
export class AdminController {
    constructor(private readonly service: MonitorServiceProvider) { }
    @Get("/health")
    health() {
        return { ok: true };
    }
    @Get("/api/overview")
    async overview() {
        const [stats, observability] = await Promise.all([
            this.service.getOverview(),
            this.service.getObservabilityOverview()
        ]);
        return {
            stats,
            observability: observability.observability
        };
    }
    @Get("/api/tasks")
    async listTasks() {
        return { tasks: await this.service.listTasks() };
    }
    @Get("/api/default-workspace")
    getDefaultWorkspace() {
        return { workspacePath: this.service.getDefaultWorkspacePath() };
    }
    @Get("/api/observability/overview")
    async observabilityOverview() {
        return this.service.getObservabilityOverview();
    }
    @Get("/api/tasks/:taskId/observability")
    async taskObservability(
    @Param("taskId")
    taskId: string) {
        const observability = await this.service.getTaskObservability(TaskId(taskId));
        if (!observability) {
            throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        }
        return observability;
    }
    @Get("/api/tasks/:taskId/openinference")
    async taskOpenInference(
    @Param("taskId")
    taskId: string) {
        const exportPayload = await this.service.getTaskOpenInference(TaskId(taskId));
        if (!exportPayload) {
            throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        }
        return exportPayload;
    }
    @Get("/api/tasks/:taskId")
    async getTask(
    @Param("taskId")
    taskId: string) {
        const task = await this.service.getTask(TaskId(taskId));
        if (!task) {
            throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        }
        const [timeline, runtimeSession] = await Promise.all([
            this.service.getTaskTimeline(task.id),
            this.service.getTaskLatestRuntimeSession(task.id)
        ]);
        return {
            task,
            timeline,
            ...(runtimeSession ? {
                runtimeSessionId: runtimeSession.runtimeSessionId,
                runtimeSource: runtimeSession.runtimeSource
            } : {})
        };
    }
}
