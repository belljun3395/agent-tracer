import type { Provider } from "@nestjs/common";
import type { IEventRepository, ITaskRepository, ITurnPartitionRepository } from "~application/index.js";
import {
    GetTurnPartitionUseCase,
    ResetTurnPartitionUseCase,
    UpsertTurnPartitionUseCase,
} from "~application/workflow/index.js";
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
