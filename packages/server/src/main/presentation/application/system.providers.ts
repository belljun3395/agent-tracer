import type { Provider } from "@nestjs/common";
import type { IEventRepository, ISessionRepository, ITaskRepository } from "~application/index.js";
import {
    GetObservabilityOverviewUseCase,
    GetOverviewUseCase,
} from "~application/index.js";
import { GetDefaultWorkspacePathUseCase } from "~application/tasks/index.js";
import {
    EVENT_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const SYSTEM_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: GetOverviewUseCase,
        useFactory: (tasks: ITaskRepository) => new GetOverviewUseCase(tasks),
        inject: [TASK_REPOSITORY_TOKEN],
    },
    {
        provide: GetObservabilityOverviewUseCase,
        useFactory: (tasks: ITaskRepository, sessions: ISessionRepository, events: IEventRepository) =>
            new GetObservabilityOverviewUseCase(tasks, sessions, events),
        inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
    },
    {
        provide: GetDefaultWorkspacePathUseCase,
        useFactory: () => new GetDefaultWorkspacePathUseCase(),
        inject: [],
    },
];

export const SYSTEM_APPLICATION_EXPORTS = [
    GetOverviewUseCase,
    GetObservabilityOverviewUseCase,
    GetDefaultWorkspacePathUseCase,
] as const;
