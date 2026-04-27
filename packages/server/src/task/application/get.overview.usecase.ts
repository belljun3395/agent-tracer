import { Injectable } from "@nestjs/common";
import { tallyTaskStatuses } from "~domain/monitoring/common/task.status.js";
import { TaskQueryService } from "../service/task.query.service.js";
import type { GetOverviewUseCaseIn, GetOverviewUseCaseOut } from "./dto/get.overview.usecase.dto.js";

@Injectable()
export class GetOverviewUseCase {
    constructor(private readonly query: TaskQueryService) {}

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
