import { analyzeTaskObservability, buildMentionedFileVerifications } from "~domain/index.js";
import type { ITaskRepository, ISessionRepository, IEventRepository } from "../ports/index.js";
import type { GetTaskObservabilityUseCaseIn, GetTaskObservabilityUseCaseOut } from "./dto/get.task.observability.usecase.dto.js";

export class GetTaskObservabilityUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly sessionRepo: ISessionRepository,
        private readonly eventRepo: IEventRepository,
    ) {}

    async execute(input: GetTaskObservabilityUseCaseIn): Promise<GetTaskObservabilityUseCaseOut | undefined> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) return undefined;
        const [sessions, timeline] = await Promise.all([
            this.sessionRepo.findByTaskId(input.taskId),
            this.eventRepo.findByTaskId(input.taskId),
        ]);
        return {
            observability: analyzeTaskObservability({ task, sessions, timeline }),
            mentionedFileVerifications: buildMentionedFileVerifications(timeline, task.workspacePath),
        };
    }
}
