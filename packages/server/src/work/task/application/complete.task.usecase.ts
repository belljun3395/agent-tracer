import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskLifecycleService } from "../service/task.lifecycle.service.js";
import type { CompleteTaskUseCaseIn, CompleteTaskUseCaseOut } from "./dto/complete.task.usecase.dto.js";

@Injectable()
export class CompleteTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    @Transactional()
    async execute(input: CompleteTaskUseCaseIn): Promise<CompleteTaskUseCaseOut> {
        const result = await this.taskLifecycle.finalizeTask({
            taskId: input.taskId,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            outcome: "completed",
        });
        return result as unknown as CompleteTaskUseCaseOut;
    }
}
