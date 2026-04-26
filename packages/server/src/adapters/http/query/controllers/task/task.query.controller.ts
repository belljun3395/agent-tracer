import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { GetTaskLatestRuntimeSessionUseCase } from "~application/tasks/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "~application/tasks/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "~application/tasks/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "~application/tasks/get.task.turns.usecase.js";
import { GetTaskUseCase } from "~application/tasks/get.task.usecase.js";
import { ListTasksUseCase } from "~application/tasks/list.tasks.usecase.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks")
export class TaskQueryController {
    constructor(
        @Inject(ListTasksUseCase) private readonly listTasks: ListTasksUseCase,
        @Inject(GetTaskUseCase) private readonly getTask: GetTaskUseCase,
        @Inject(GetTaskTimelineUseCase) private readonly getTaskTimeline: GetTaskTimelineUseCase,
        @Inject(GetTaskTurnsUseCase) private readonly getTaskTurns: GetTaskTurnsUseCase,
        @Inject(GetTaskLatestRuntimeSessionUseCase) private readonly getTaskLatestRuntimeSession: GetTaskLatestRuntimeSessionUseCase,
        @Inject(GetTaskOpenInferenceUseCase) private readonly getTaskOpenInference: GetTaskOpenInferenceUseCase,
    ) {}

    @Get()
    async listTasksEndpoint() {
        return this.listTasks.execute({});
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
        const [timeline, turns, runtimeSession] = await Promise.all([
            this.getTaskTimeline.execute({ taskId: task.id }),
            this.getTaskTurns.execute({ taskId: task.id }),
            this.getTaskLatestRuntimeSession.execute({ taskId: task.id }),
        ]);
        return {
            task,
            timeline: timeline.timeline,
            turns: turns.turns,
            ...(runtimeSession.runtimeSession ? {
                runtimeSessionId: runtimeSession.runtimeSession.runtimeSessionId,
                runtimeSource: runtimeSession.runtimeSession.runtimeSource,
            } : {}),
        };
    }
}
