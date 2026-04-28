import { Inject, Injectable } from "@nestjs/common";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { EVENT_STORE_APPENDER_PORT, TASK_ACCESS_PORT } from "./outbound/tokens.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type { IEventStoreAppender } from "./outbound/event.store.appender.port.js";
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
        @Inject(EVENT_STORE_APPENDER_PORT) private readonly eventStore: IEventStoreAppender,
    ) {}

    async execute(input: ResetTurnPartitionUseCaseIn): Promise<ResetTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);
        const deleted = await this.turnPartitions.delete(input.taskId);
        if (deleted) {
            await this.eventStore.append({
                type: "turn.partition_reset",
                taskId: input.taskId,
                resetAt: new Date().toISOString(),
            });
        }
    }
}
