import type { Provider } from "@nestjs/common";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IRuntimeBindingRepository } from "~application/ports/repository/runtime.binding.repository.js";
import type { ISessionRepository } from "~application/ports/repository/session.repository.js";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import { EndRuntimeSessionUseCase } from "~application/sessions/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "~application/sessions/ensure.runtime.session.usecase.js";
import { TaskLifecycleService } from "~application/tasks/services/task.lifecycle.service.js";
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
