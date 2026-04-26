import type { TaskLifecycleService } from "./services/task.lifecycle.service.js";
import type { CompleteTaskUseCaseIn, CompleteTaskUseCaseOut } from "./dto/complete.task.usecase.dto.js";

export class CompleteTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: CompleteTaskUseCaseIn): Promise<CompleteTaskUseCaseOut> {
        return this.taskLifecycle.finalizeTask({
            taskId: input.taskId,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            outcome: "completed",
        });
    }
}
