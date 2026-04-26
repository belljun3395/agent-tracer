import type { TaskReadPort } from "~application/ports/tasks/task.read.port.js";
import type { TurnPartitionPort } from "~application/ports/turn-partitions/turn.partition.port.js";
import { TaskNotFoundError } from "./common/turn-partition.errors.js";
import type { ResetTurnPartitionUseCaseIn, ResetTurnPartitionUseCaseOut } from "./dto/reset.turn.partition.usecase.dto.js";

export class ResetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: TaskReadPort,
        private readonly turnPartitionRepo: TurnPartitionPort,
    ) {}

    async execute(input: ResetTurnPartitionUseCaseIn): Promise<ResetTurnPartitionUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        await this.turnPartitionRepo.delete(input.taskId);
    }
}
