import { Inject, Injectable } from "@nestjs/common";
import { resolveTurnPartition } from "../domain/turn.partition.js";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { TASK_ACCESS_PORT, TIMELINE_EVENT_ACCESS_PORT } from "./outbound/tokens.js";
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
    ) {}

    async execute(input: GetTurnPartitionUseCaseIn): Promise<GetTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        const events = await this.events.findByTaskId(input.taskId);
        const stored = await this.turnPartitions.get(input.taskId);
        const now = new Date().toISOString();
        return resolveTurnPartition({
            taskId: input.taskId,
            stored,
            events: events as unknown as readonly TimelineEvent[],
            fallbackUpdatedAt: now,
        });
    }
}
