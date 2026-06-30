import { Inject, Injectable } from "@nestjs/common";
import { resolveTurnPartition } from "../domain/turn.partition.policy.js";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "./outbound/tokens.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { ITaskAccess } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/iservice/timeline.event.read.iservice.js";
import type {
    GetTurnPartitionUseCaseIn,
    GetTurnPartitionUseCaseOut,
} from "./dto/get.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "../common/turn.partition.errors.js";

@Injectable()
export class GetTurnPartitionUseCase {
    constructor(
        @Inject(TASK_ACCESS) private readonly tasks: ITaskAccess,
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
        private readonly turnPartitions: TurnPartitionRepository,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
        @Inject(ID_GENERATOR_PORT) private readonly idGen: IIdGenerator,
    ) {}

    async execute(input: GetTurnPartitionUseCaseIn): Promise<GetTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        const events = await this.events.findByTaskId(input.taskId);
        const stored = await this.turnPartitions.get(input.taskId);
        return resolveTurnPartition(
            {
                taskId: input.taskId,
                stored,
                events,
                fallbackUpdatedAt: this.clock.nowIso(),
            },
            () => `tg-${this.idGen.newUuid()}`,
        );
    }
}
