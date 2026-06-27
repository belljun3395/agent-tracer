import { Injectable } from "@nestjs/common";
import { tallyTaskStatuses } from "@monitor/run-api/task/common/task.status.helpers.js";
import { TaskReadService } from "../service/task.read.service.js";
import type { GetOverviewUseCaseIn, GetOverviewUseCaseOut } from "./dto/get.overview.usecase.dto.js";

@Injectable()
export class GetOverviewUseCase {
    constructor(private readonly query: TaskReadService) {}

    async execute(_input: GetOverviewUseCaseIn): Promise<GetOverviewUseCaseOut> {
        const [statuses, totalEvents] = await Promise.all([
            this.query.listTaskStatuses(),
            this.query.countTimelineEvents(),
        ]);
        return {
            ...tallyTaskStatuses(statuses),
            totalEvents,
        };
    }
}
