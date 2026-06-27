import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { TASK_ACCESS_PORT } from "./outbound/tokens.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type {
    ResetTurnPartitionUseCaseIn,
    ResetTurnPartitionUseCaseOut,
} from "./dto/reset.turn.partition.usecase.dto.js";
import { TaskNotFoundError } from "../common/turn.partition.errors.js";

@Injectable()
export class ResetTurnPartitionUseCase {
    constructor(
        @Inject(TASK_ACCESS_PORT) private readonly tasks: ITaskAccess,
        private readonly turnPartitions: TurnPartitionRepository,
    ) {}

    @Transactional()
    async execute(input: ResetTurnPartitionUseCaseIn): Promise<ResetTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        await this.turnPartitions.delete(input.taskId);
    }
}
