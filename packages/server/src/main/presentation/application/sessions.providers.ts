import type { Provider } from "@nestjs/common";
import type {
    INotificationPublisher,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
} from "~application/index.js";
import {
    EndRuntimeSessionUseCase,
    EnsureRuntimeSessionUseCase,
} from "~application/sessions/index.js";
import { TaskLifecycleService } from "~application/tasks/index.js";
import {
    NOTIFICATION_PUBLISHER_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const SESSIONS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: EnsureRuntimeSessionUseCase,
        useFactory: (
            tasks: ITaskRepository,
            sessions: ISessionRepository,
            runtimeBindings: IRuntimeBindingRepository,
            notifier: INotificationPublisher,
            taskLifecycle: TaskLifecycleService,
        ) => new EnsureRuntimeSessionUseCase(tasks, sessions, runtimeBindings, notifier, taskLifecycle),
        inject: [
            TASK_REPOSITORY_TOKEN,
            SESSION_REPOSITORY_TOKEN,
            RUNTIME_BINDING_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
            TaskLifecycleService,
        ],
    },
    {
        provide: EndRuntimeSessionUseCase,
        useFactory: (
            tasks: ITaskRepository,
            sessions: ISessionRepository,
            runtimeBindings: IRuntimeBindingRepository,
            notifier: INotificationPublisher,
            taskLifecycle: TaskLifecycleService,
        ) => new EndRuntimeSessionUseCase(tasks, sessions, runtimeBindings, notifier, taskLifecycle),
        inject: [
            TASK_REPOSITORY_TOKEN,
            SESSION_REPOSITORY_TOKEN,
            RUNTIME_BINDING_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
            TaskLifecycleService,
        ],
    },
];

export const SESSIONS_APPLICATION_EXPORTS = [
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
] as const;
