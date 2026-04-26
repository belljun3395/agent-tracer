import type { TaskOverviewQueryPort } from "~application/ports/tasks/task.overview.query.port.js";
import { tallyTaskStatuses } from "~domain/monitoring/common/task.status.js";
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
