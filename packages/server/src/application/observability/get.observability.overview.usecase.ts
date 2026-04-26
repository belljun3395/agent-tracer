import type { ITaskRepository, ISessionRepository, IEventRepository } from "../ports/index.js";
import type { GetObservabilityOverviewUseCaseIn, GetObservabilityOverviewUseCaseOut } from "./dto/get.observability.overview.usecase.dto.js";
import { analyzeObservabilityOverview } from "./projection/overview.ops.js";

export class GetObservabilityOverviewUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly sessionRepo: ISessionRepository,
        private readonly eventRepo: IEventRepository,
    ) {}

    async execute(_input: GetObservabilityOverviewUseCaseIn): Promise<GetObservabilityOverviewUseCaseOut> {
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
