import type { IEventRepository, ITaskRepository, ITurnPartitionRepository } from "~application/ports/index.js";
import type { TurnPartition } from "~domain/workflow/turn.partition.js";
import { resolveTurnPartition } from "~domain/workflow/turn.partition.js";

export class GetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly turnPartitionRepo: ITurnPartitionRepository,
    ) {}

    async execute(taskId: string): Promise<TurnPartition> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);
        const events = await this.eventRepo.findByTaskId(taskId);
        const stored = await this.turnPartitionRepo.get(taskId);
        const now = new Date().toISOString();
        return resolveTurnPartition({
            taskId,
            stored,
            events,
            fallbackUpdatedAt: now,
        });
    }
}
