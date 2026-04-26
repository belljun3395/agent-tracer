import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { GetTaskObservabilityUseCase } from "~application/index.js";
import {
    GetTaskLatestRuntimeSessionUseCase,
    GetTaskOpenInferenceUseCase,
    GetTaskTimelineUseCase,
    GetTaskUseCase,
    ListTasksUseCase,
} from "~application/tasks/index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

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

    @Get()
    async listTasksEndpoint() {
        return this.listTasks.execute({});
    }

    @Get(":taskId/observability")
    async taskObservability(@Param("taskId", pathParamPipe) taskId: string) {
        const observability = await this.getTaskObservability.execute({ taskId });
        if (!observability) throw new NotFoundException("Task not found");
        return observability;
    }

    @Get(":taskId/openinference")
    async taskOpenInference(@Param("taskId", pathParamPipe) taskId: string) {
        const exportPayload = await this.getTaskOpenInference.execute({ taskId });
        if (!exportPayload) throw new NotFoundException("Task not found");
        return exportPayload;
    }

    @Get(":taskId")
    async getTaskEndpoint(@Param("taskId", pathParamPipe) taskId: string) {
        const { task } = await this.getTask.execute({ taskId });
        if (!task) throw new NotFoundException("Task not found");
        const [timeline, runtimeSession] = await Promise.all([
            this.getTaskTimeline.execute({ taskId: task.id }),
            this.getTaskLatestRuntimeSession.execute({ taskId: task.id }),
        ]);
        return {
            task,
            timeline: timeline.timeline,
            ...(runtimeSession.runtimeSession ? {
                runtimeSessionId: runtimeSession.runtimeSession.runtimeSessionId,
                runtimeSource: runtimeSession.runtimeSession.runtimeSource,
            } : {}),
        };
    }
}
