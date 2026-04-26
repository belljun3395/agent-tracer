import type { ITaskRepository, ITurnPartitionRepository } from "~application/ports/index.js";
import { TaskNotFoundError } from "./common/workflow.errors.js";
import type { ResetTurnPartitionUseCaseIn, ResetTurnPartitionUseCaseOut } from "./dto/reset.turn.partition.usecase.dto.js";

export class ResetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly turnPartitionRepo: ITurnPartitionRepository,
    ) {}

    async execute(input: ResetTurnPartitionUseCaseIn): Promise<ResetTurnPartitionUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        await this.turnPartitionRepo.delete(input.taskId);
    }
}
