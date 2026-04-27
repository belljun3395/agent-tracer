import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { GetTaskLatestRuntimeSessionUseCase } from "../application/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "../application/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "../application/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "../application/get.task.turns.usecase.js";
import { GetTaskUseCase } from "../application/get.task.usecase.js";
import { ListTasksUseCase } from "../application/list.tasks.usecase.js";

@Controller("api/v1/tasks")
export class TaskQueryController {
    constructor(
        private readonly listTasks: ListTasksUseCase,
        private readonly getTask: GetTaskUseCase,
        private readonly getTaskTimeline: GetTaskTimelineUseCase,
        private readonly getTaskTurns: GetTaskTurnsUseCase,
        private readonly getTaskLatestRuntimeSession: GetTaskLatestRuntimeSessionUseCase,
        private readonly getTaskOpenInference: GetTaskOpenInferenceUseCase,
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
