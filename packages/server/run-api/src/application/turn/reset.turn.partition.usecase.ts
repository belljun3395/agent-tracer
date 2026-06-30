import { Injectable } from "@nestjs/common";
import { TaskAccessPublicAdapter } from "../../adapter/task/task.access.public.adapter.js";
import { Transactional } from "typeorm-transactional";
import { TurnPartitionRepository } from "../../repository/turn/turn.partition.repository.js";
import type {
    ResetTurnPartitionUseCaseIn,
    ResetTurnPartitionUseCaseOut,
} from "./dto/reset.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "../../domain/turn/turn.partition.errors.js";

@Injectable()
export class ResetTurnPartitionUseCase {
    constructor(
        private readonly tasks: TaskAccessPublicAdapter,
        private readonly turnPartitions: TurnPartitionRepository,
    ) {}

    @Transactional()
    async execute(input: ResetTurnPartitionUseCaseIn): Promise<ResetTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        await this.turnPartitions.delete(input.taskId);
    }
}
