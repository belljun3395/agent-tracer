import { Controller, Get, Param, HttpException, HttpStatus, Inject } from "@nestjs/common";
import {
    GetOverviewUseCase,
    GetObservabilityOverviewUseCase,
    GetTaskObservabilityUseCase,
} from "~application/index.js";
import {
    ListTasksUseCase,
    GetTaskUseCase,
    GetTaskTimelineUseCase,
    GetTaskLatestRuntimeSessionUseCase,
    GetTaskOpenInferenceUseCase,
    GetDefaultWorkspacePathUseCase,
} from "~application/tasks/index.js";

@Controller()
export class AdminController {
    constructor(
        @Inject(GetOverviewUseCase) private readonly getOverview: GetOverviewUseCase,
        @Inject(GetObservabilityOverviewUseCase) private readonly getObservabilityOverview: GetObservabilityOverviewUseCase,
        @Inject(GetTaskObservabilityUseCase) private readonly getTaskObservability: GetTaskObservabilityUseCase,
        @Inject(ListTasksUseCase) private readonly listTasks: ListTasksUseCase,
        @Inject(GetTaskUseCase) private readonly getTask: GetTaskUseCase,
        @Inject(GetTaskTimelineUseCase) private readonly getTaskTimeline: GetTaskTimelineUseCase,
        @Inject(GetTaskLatestRuntimeSessionUseCase) private readonly getTaskLatestRuntimeSession: GetTaskLatestRuntimeSessionUseCase,
        @Inject(GetTaskOpenInferenceUseCase) private readonly getTaskOpenInference: GetTaskOpenInferenceUseCase,
        @Inject(GetDefaultWorkspacePathUseCase) private readonly getDefaultWorkspacePath: GetDefaultWorkspacePathUseCase,
    ) {}

    @Get("/health")
    health() {
        return { ok: true };
    }

    @Get("/api/overview")
    async overview() {
        const [stats, observability] = await Promise.all([
            this.getOverview.execute(),
            this.getObservabilityOverview.execute(),
        ]);
        return { stats, observability: observability.observability };
    }

    @Get("/api/tasks")
    async listTasksEndpoint() {
        return { tasks: await this.listTasks.execute() };
    }

    @Get("/api/default-workspace")
    getDefaultWorkspaceEndpoint() {
        return { workspacePath: this.getDefaultWorkspacePath.execute() };
    }

    @Get("/api/observability/overview")
    async observabilityOverview() {
        return this.getObservabilityOverview.execute();
    }

    @Get("/api/tasks/:taskId/observability")
    async taskObservability(@Param("taskId") taskId: string) {
        const observability = await this.getTaskObservability.execute(taskId);
        if (!observability) throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        return observability;
    }

    @Get("/api/tasks/:taskId/openinference")
    async taskOpenInference(@Param("taskId") taskId: string) {
        const exportPayload = await this.getTaskOpenInference.execute(taskId);
        if (!exportPayload) throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        return exportPayload;
    }

    @Get("/api/tasks/:taskId")
    async getTaskEndpoint(@Param("taskId") taskId: string) {
        const task = await this.getTask.execute(taskId);
        if (!task) throw new HttpException({ error: "Task not found" }, HttpStatus.NOT_FOUND);
        const [timeline, runtimeSession] = await Promise.all([
            this.getTaskTimeline.execute(task.id),
            this.getTaskLatestRuntimeSession.execute(task.id),
        ]);
        return {
            task,
            timeline,
            ...(runtimeSession ? {
                runtimeSessionId: runtimeSession.runtimeSessionId,
                runtimeSource: runtimeSession.runtimeSource,
            } : {}),
        };
    }
}
