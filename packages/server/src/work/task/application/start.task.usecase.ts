import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskLifecycleService } from "../service/task.lifecycle.service.js";
import type { StartTaskUseCaseIn, StartTaskUseCaseOut } from "./dto/start.task.usecase.dto.js";

@Injectable()
export class StartTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    @Transactional()
    async execute(input: StartTaskUseCaseIn): Promise<StartTaskUseCaseOut> {
        const result = await this.taskLifecycle.startTask({
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            title: input.title,
            ...(input.workspacePath !== undefined ? { workspacePath: input.workspacePath } : {}),
            ...(input.runtimeSource !== undefined ? { runtimeSource: input.runtimeSource } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.taskKind !== undefined ? { taskKind: input.taskKind } : {}),
            ...(input.parentTaskId !== undefined ? { parentTaskId: input.parentTaskId } : {}),
            ...(input.parentSessionId !== undefined ? { parentSessionId: input.parentSessionId } : {}),
            ...(input.backgroundTaskId !== undefined ? { backgroundTaskId: input.backgroundTaskId } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        });
        return result as unknown as StartTaskUseCaseOut;
    }
}
