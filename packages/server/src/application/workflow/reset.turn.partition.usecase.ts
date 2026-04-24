import type { ITaskRepository, ITurnPartitionRepository } from "~application/ports/index.js";
import { TaskNotFoundError } from "./workflow.errors.js";

export class ResetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly turnPartitionRepo: ITurnPartitionRepository,
    ) {}

    async execute(taskId: string): Promise<void> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) throw new TaskNotFoundError(taskId);
        await this.turnPartitionRepo.delete(taskId);
    }
}
