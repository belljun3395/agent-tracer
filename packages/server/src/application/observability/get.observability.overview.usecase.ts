import { analyzeObservabilityOverview } from "./index.js";
import type { ITaskRepository, ISessionRepository, IEventRepository } from "../ports/index.js";
import type { ObservabilityOverviewResponse } from "./observability.metrics.type.js";

export class GetObservabilityOverviewUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly sessionRepo: ISessionRepository,
        private readonly eventRepo: IEventRepository,
    ) {}

    async execute(): Promise<ObservabilityOverviewResponse> {
        const tasks = await this.taskRepo.findAll();
        const sessionEntries = await Promise.all(
            tasks.map(async (task) => [task.id, await this.sessionRepo.findByTaskId(task.id)] as const),
        );
        const timelineEntries = await Promise.all(
            tasks.map(async (task) => [task.id, await this.eventRepo.findByTaskId(task.id)] as const),
        );
        return {
            observability: analyzeObservabilityOverview({
                tasks,
                sessionsByTaskId: new Map(sessionEntries),
                timelinesByTaskId: new Map(timelineEntries),
            }),
        };
    }
}
