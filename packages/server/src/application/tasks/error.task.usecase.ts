import type { TaskLifecycleService } from "./services/task.lifecycle.service.js";
import type { ErrorTaskUseCaseIn, ErrorTaskUseCaseOut } from "./dto/error.task.usecase.dto.js";

export class ErrorTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: ErrorTaskUseCaseIn): Promise<ErrorTaskUseCaseOut> {
        return this.taskLifecycle.finalizeTask({
            taskId: input.taskId,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            errorMessage: input.errorMessage,
            outcome: "errored",
        });
    }
}
