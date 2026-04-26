import type { Provider } from "@nestjs/common";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import { GetDefaultWorkspacePathUseCase } from "~application/tasks/get.default.workspace.path.usecase.js";
import { GetOverviewUseCase } from "~application/tasks/get.overview.usecase.js";
import { TASK_REPOSITORY_TOKEN } from "../database/database.provider.js";

export const SYSTEM_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: GetOverviewUseCase,
        useFactory: (tasks: ITaskRepository) => new GetOverviewUseCase(tasks),
        inject: [TASK_REPOSITORY_TOKEN],
    },
    {
        provide: GetDefaultWorkspacePathUseCase,
        useFactory: () => new GetDefaultWorkspacePathUseCase(),
        inject: [],
    },
];

export const SYSTEM_APPLICATION_EXPORTS = [
    GetOverviewUseCase,
    GetDefaultWorkspacePathUseCase,
] as const;
