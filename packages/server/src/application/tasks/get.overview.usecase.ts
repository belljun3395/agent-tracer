import type { TaskOverviewQueryPort } from "~application/ports/index.js";
import { tallyTaskStatuses } from "~domain/monitoring/index.js";
import type { GetOverviewUseCaseIn, GetOverviewUseCaseOut } from "./dto/get.overview.usecase.dto.js";

export class GetOverviewUseCase {
    constructor(private readonly taskRepo: TaskOverviewQueryPort) {}

    async execute(_input: GetOverviewUseCaseIn): Promise<GetOverviewUseCaseOut> {
        const [statuses, totalEvents] = await Promise.all([
            this.taskRepo.listTaskStatuses(),
            this.taskRepo.countTimelineEvents(),
        ]);
        return {
            ...tallyTaskStatuses(statuses),
            totalEvents,
        };
    }
}
