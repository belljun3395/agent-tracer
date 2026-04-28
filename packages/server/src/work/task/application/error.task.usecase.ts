import { Injectable } from "@nestjs/common";
import { TaskLifecycleService } from "../service/task.lifecycle.service.js";
import type { ErrorTaskUseCaseIn, ErrorTaskUseCaseOut } from "./dto/error.task.usecase.dto.js";

@Injectable()
export class ErrorTaskUseCase {
    constructor(private readonly taskLifecycle: TaskLifecycleService) {}

    async execute(input: ErrorTaskUseCaseIn): Promise<ErrorTaskUseCaseOut> {
        const result = await this.taskLifecycle.finalizeTask({
            taskId: input.taskId,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.summary !== undefined ? { summary: input.summary } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            errorMessage: input.errorMessage,
            outcome: "errored",
        });
        return result as unknown as ErrorTaskUseCaseOut;
    }
}
