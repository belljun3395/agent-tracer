import { Inject, Injectable } from "@nestjs/common";
import { resolveTurnPartition } from "../domain/turn.partition.js";
import type { TimelineEvent } from "~activity/event/public/types/event.types.js";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { CLOCK_PORT, ID_GENERATOR_PORT, TASK_ACCESS_PORT, TIMELINE_EVENT_ACCESS_PORT } from "./outbound/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { IIdGenerator } from "./outbound/id.generator.port.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type { ITimelineEventAccess } from "./outbound/timeline.event.access.port.js";
import type {
    GetTurnPartitionUseCaseIn,
    GetTurnPartitionUseCaseOut,
} from "./dto/get.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "../common/turn.partition.errors.js";

@Injectable()
export class GetTurnPartitionUseCase {
    constructor(
        @Inject(TASK_ACCESS_PORT) private readonly tasks: ITaskAccess,
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
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
                events: events as unknown as readonly TimelineEvent[],
                fallbackUpdatedAt: this.clock.nowIso(),
            },
            () => `tg-${this.idGen.newUuid()}`,
        );
    }
}
