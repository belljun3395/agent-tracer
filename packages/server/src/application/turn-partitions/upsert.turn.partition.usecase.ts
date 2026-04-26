import type { TaskReadPort, TimelineEventReadPort, TurnPartitionPort } from "~application/ports/index.js";
import { createTurnPartitionUpdate, countNonPreludeTurns, validatePartition } from "~domain/turn-partitions/index.js";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "./common/turn-partition.errors.js";
import type { UpsertTurnPartitionUseCaseIn, UpsertTurnPartitionUseCaseOut } from "./dto/upsert.turn.partition.usecase.dto.js";

export class UpsertTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: TaskReadPort,
        private readonly eventRepo: TimelineEventReadPort,
        private readonly turnPartitionRepo: TurnPartitionPort,
    ) {}

    async execute(input: UpsertTurnPartitionUseCaseIn): Promise<UpsertTurnPartitionUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const events = await this.eventRepo.findByTaskId(input.taskId);
        const totalTurns = countNonPreludeTurns(events);

        const existing = await this.turnPartitionRepo.get(input.taskId);
        if (
            typeof input.baseVersion === "number" &&
            existing !== null &&
            existing.version !== input.baseVersion
        ) {
            throw new TurnPartitionVersionMismatchError(input.baseVersion, existing.version);
        }

        const updatedAt = new Date().toISOString();
        const partition = createTurnPartitionUpdate({
            taskId: input.taskId,
            groups: input.groups,
            existing,
            updatedAt,
        });
        validatePartition(partition, totalTurns);
        await this.turnPartitionRepo.upsert(partition);
        return partition;
    }
}
