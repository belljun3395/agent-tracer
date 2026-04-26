import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
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
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { NoEnvelope } from "~main/presentation/decorators/index.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    // [caller: runtime, web] GET /health — liveness probe; runtime checks server reachability, web checks connectivity
    @Get()
    health() {
        return { ok: true };
    }
}

@Controller("api/v1")
export class SystemQueryController {
    constructor(
        @Inject(GetOverviewUseCase) private readonly getOverview: GetOverviewUseCase,
        @Inject(GetObservabilityOverviewUseCase) private readonly getObservabilityOverview: GetObservabilityOverviewUseCase,
        @Inject(GetDefaultWorkspacePathUseCase) private readonly getDefaultWorkspacePath: GetDefaultWorkspacePathUseCase,
    ) {}

    // [caller: web] GET /api/v1/overview — dashboard stats and observability summary shown on the main page
    @Get("overview")
    async overview() {
        const [stats, observability] = await Promise.all([
            this.getOverview.execute(),
            this.getObservabilityOverview.execute(),
        ]);
        return { stats, observability: observability.observability };
    }

    // [caller: web] GET /api/v1/default-workspace — provides the workspace path used as a default task label
    @Get("default-workspace")
    getDefaultWorkspaceEndpoint() {
        return { workspacePath: this.getDefaultWorkspacePath.execute() };
    }

    // [caller: web] GET /api/v1/observability/overview — full observability report for the observability dashboard tab
    @Get("observability/overview")
    async observabilityOverview() {
        return this.getObservabilityOverview.execute();
    }
}

@Controller("api/v1/tasks")
export class TaskQueryController {
    constructor(
        @Inject(GetTaskObservabilityUseCase) private readonly getTaskObservability: GetTaskObservabilityUseCase,
        @Inject(ListTasksUseCase) private readonly listTasks: ListTasksUseCase,
        @Inject(GetTaskUseCase) private readonly getTask: GetTaskUseCase,
        @Inject(GetTaskTimelineUseCase) private readonly getTaskTimeline: GetTaskTimelineUseCase,
        @Inject(GetTaskLatestRuntimeSessionUseCase) private readonly getTaskLatestRuntimeSession: GetTaskLatestRuntimeSessionUseCase,
        @Inject(GetTaskOpenInferenceUseCase) private readonly getTaskOpenInference: GetTaskOpenInferenceUseCase,
    ) {}

    // [caller: web] GET /api/v1/tasks — task list shown in the sidebar / task picker
    @Get()
    async listTasksEndpoint() {
        return { tasks: await this.listTasks.execute() };
    }

    // [caller: web] GET /api/v1/tasks/:taskId/observability — per-task observability metrics panel
    @Get(":taskId/observability")
    async taskObservability(@Param("taskId", pathParamPipe) taskId: string) {
        const observability = await this.getTaskObservability.execute(taskId);
        if (!observability) throw new NotFoundException("Task not found");
        return observability;
    }

    // [caller: web] GET /api/v1/tasks/:taskId/openinference — OpenInference span export for the task
    @Get(":taskId/openinference")
    async taskOpenInference(@Param("taskId", pathParamPipe) taskId: string) {
        const exportPayload = await this.getTaskOpenInference.execute(taskId);
        if (!exportPayload) throw new NotFoundException("Task not found");
        return exportPayload;
    }

    // [caller: web] GET /api/v1/tasks/:taskId — full task detail including timeline and latest session, used when opening a task
    @Get(":taskId")
    async getTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const task = await this.getTask.execute(taskId);
        if (!task) throw new NotFoundException("Task not found");
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
