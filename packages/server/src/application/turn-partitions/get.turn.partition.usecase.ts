import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TimelineEventReadPort } from "~application/ports/timeline-events/timeline.event.read.port.js";
import type { TurnPartitionPort } from "~application/ports/turn-partitions/turn.partition.port.js";
import { resolveTurnPartition } from "~domain/turn-partitions/turn.partition.js";
import type { GetTurnPartitionUseCaseIn, GetTurnPartitionUseCaseOut } from "./dto/get.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "./common/turn-partition.errors.js";

export class GetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: TaskReadPort,
        private readonly eventRepo: TimelineEventReadPort,
        private readonly turnPartitionRepo: TurnPartitionPort,
    ) {}

    async execute(input: GetTurnPartitionUseCaseIn): Promise<GetTurnPartitionUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        const events = await this.eventRepo.findByTaskId(input.taskId);
        const stored = await this.turnPartitionRepo.get(input.taskId);
        const now = new Date().toISOString();
        return resolveTurnPartition({
            taskId: input.taskId,
            stored,
            events,
            fallbackUpdatedAt: now,
        });
    }
}
