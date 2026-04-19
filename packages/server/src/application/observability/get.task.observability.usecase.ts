import { buildMentionedFileVerifications } from "../views/index.js";
import { analyzeTaskObservability } from "./index.js";
import type { ITaskRepository, ISessionRepository, IEventRepository } from "../ports/index.js";
import type { TaskObservabilityResponse } from "./observability.metrics.type.js";

export class GetTaskObservabilityUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly sessionRepo: ISessionRepository,
        private readonly eventRepo: IEventRepository,
    ) {}

    async execute(taskId: string): Promise<TaskObservabilityResponse | undefined> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) return undefined;
        const [sessions, timeline] = await Promise.all([
            this.sessionRepo.findByTaskId(taskId),
            this.eventRepo.findByTaskId(taskId),
        ]);
        return {
            observability: analyzeTaskObservability({ task, sessions, timeline }),
            mentionedFileVerifications: buildMentionedFileVerifications(timeline, task.workspacePath),
        };
    }
}
