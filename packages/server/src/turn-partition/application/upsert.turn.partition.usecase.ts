import { Inject, Injectable } from "@nestjs/common";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { countNonPreludeTurns, createTurnPartitionUpdate, validatePartition } from "../domain/turn.partition.js";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import {
    EVENT_STORE_APPENDER_PORT,
    TASK_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT,
} from "./outbound/tokens.js";
import type { ITaskAccess } from "./outbound/task.access.port.js";
import type { ITimelineEventAccess } from "./outbound/timeline.event.access.port.js";
import type { IEventStoreAppender } from "./outbound/event.store.appender.port.js";
import type {
    UpsertTurnPartitionUseCaseIn,
    UpsertTurnPartitionUseCaseOut,
} from "./dto/upsert.turn.partition.usecase.dto.js";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "../common/turn.partition.errors.js";

@Injectable()
export class UpsertTurnPartitionUseCase {
    constructor(
        @Inject(TASK_ACCESS_PORT) private readonly tasks: ITaskAccess,
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
        private readonly turnPartitions: TurnPartitionRepository,
        @Inject(EVENT_STORE_APPENDER_PORT) private readonly eventStore: IEventStoreAppender,
    ) {}

    async execute(input: UpsertTurnPartitionUseCaseIn): Promise<UpsertTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const events = await this.events.findByTaskId(input.taskId);
        const totalTurns = countNonPreludeTurns(events as unknown as readonly TimelineEvent[]);

        const existing = await this.turnPartitions.get(input.taskId);
        if (
            typeof input.baseVersion === "number"
            && existing !== null
            && existing.version !== input.baseVersion
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
        await this.turnPartitions.upsert(partition);
        this.eventStore.append({
            type: "turn.partition_updated",
            taskId: partition.taskId,
            updatedAt: partition.updatedAt,
            version: partition.version,
            groups: partition.groups.map((g) => ({ ...g })),
        });
        return partition;
    }
}
