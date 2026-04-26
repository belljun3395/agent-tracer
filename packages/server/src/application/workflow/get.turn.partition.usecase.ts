import type { IEventRepository, ITaskRepository, ITurnPartitionRepository } from "~application/ports/index.js";
import { resolveTurnPartition } from "~domain/workflow/index.js";
import type { GetTurnPartitionUseCaseIn, GetTurnPartitionUseCaseOut } from "./dto/get.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "./common/workflow.errors.js";

export class GetTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly turnPartitionRepo: ITurnPartitionRepository,
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
