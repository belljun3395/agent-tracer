import type { Provider } from "@nestjs/common";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import type { ITurnPartitionRepository } from "~application/ports/repository/turn.partition.repository.js";
import { GetTurnPartitionUseCase } from "~application/turn-partitions/get.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "~application/turn-partitions/reset.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "~application/turn-partitions/upsert.turn.partition.usecase.js";
import {
    EVENT_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
    TURN_PARTITION_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const TURN_PARTITIONS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: GetTurnPartitionUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            turnPartitions: ITurnPartitionRepository,
        ) => new GetTurnPartitionUseCase(tasks, events, turnPartitions),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
    },
    {
        provide: UpsertTurnPartitionUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            turnPartitions: ITurnPartitionRepository,
        ) => new UpsertTurnPartitionUseCase(tasks, events, turnPartitions),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
    },
    {
        provide: ResetTurnPartitionUseCase,
        useFactory: (tasks: ITaskRepository, turnPartitions: ITurnPartitionRepository) =>
            new ResetTurnPartitionUseCase(tasks, turnPartitions),
        inject: [TASK_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
    },
];

export const TURN_PARTITIONS_APPLICATION_EXPORTS = [
    GetTurnPartitionUseCase,
    UpsertTurnPartitionUseCase,
    ResetTurnPartitionUseCase,
] as const;
