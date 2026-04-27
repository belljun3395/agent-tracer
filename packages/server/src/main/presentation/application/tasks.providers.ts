import type { Provider } from "@nestjs/common";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import { CompleteTaskUseCase } from "~application/tasks/complete.task.usecase.js";
import { DeleteFinishedTasksUseCase } from "~application/tasks/delete.finished.tasks.usecase.js";
import { DeleteTaskUseCase } from "~application/tasks/delete.task.usecase.js";
import { ErrorTaskUseCase } from "~application/tasks/error.task.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "~application/tasks/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "~application/tasks/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "~application/tasks/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "~application/tasks/get.task.turns.usecase.js";
import { GetTaskUseCase } from "~application/tasks/get.task.usecase.js";
import { LinkTaskUseCase } from "~application/tasks/link.task.usecase.js";
import { ListTasksUseCase } from "~application/tasks/list.tasks.usecase.js";
import { TaskLifecycleService } from "~application/tasks/services/task.lifecycle.service.js";
import { StartTaskUseCase } from "~application/tasks/start.task.usecase.js";
import { UpdateTaskUseCase } from "~application/tasks/update.task.usecase.js";
import type { IRuntimeBindingLookup } from "~session/public/iservice/runtime.binding.lookup.iservice.js";
import type { ISessionLifecycle } from "~session/public/iservice/session.lifecycle.iservice.js";
import {
    RUNTIME_BINDING_LOOKUP,
    SESSION_LIFECYCLE,
} from "~session/public/tokens.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    TASK_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

const taskLifecycleProvider: Provider = {
    provide: TaskLifecycleService,
    useFactory: (
        tasks: ITaskRepository,
        sessions: ISessionLifecycle,
        events: IEventRepository,
        notifier: INotificationPublisher,
    ) => new TaskLifecycleService(tasks, sessions, events, notifier),
    inject: [TASK_REPOSITORY_TOKEN, SESSION_LIFECYCLE, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
};

export const TASK_APPLICATION_PROVIDERS: Provider[] = [
    taskLifecycleProvider,
    {
        provide: StartTaskUseCase,
        useFactory: (taskLifecycle: TaskLifecycleService) => new StartTaskUseCase(taskLifecycle),
        inject: [TaskLifecycleService],
    },
    {
        provide: CompleteTaskUseCase,
        useFactory: (taskLifecycle: TaskLifecycleService) => new CompleteTaskUseCase(taskLifecycle),
        inject: [TaskLifecycleService],
    },
    {
        provide: ErrorTaskUseCase,
        useFactory: (taskLifecycle: TaskLifecycleService) => new ErrorTaskUseCase(taskLifecycle),
        inject: [TaskLifecycleService],
    },
    {
        provide: UpdateTaskUseCase,
        useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
            new UpdateTaskUseCase(tasks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: LinkTaskUseCase,
        useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
            new LinkTaskUseCase(tasks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: DeleteTaskUseCase,
        useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
            new DeleteTaskUseCase(tasks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: DeleteFinishedTasksUseCase,
        useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
            new DeleteFinishedTasksUseCase(tasks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: ListTasksUseCase,
        useFactory: (tasks: ITaskRepository) => new ListTasksUseCase(tasks),
        inject: [TASK_REPOSITORY_TOKEN],
    },
    {
        provide: GetTaskUseCase,
        useFactory: (tasks: ITaskRepository) => new GetTaskUseCase(tasks),
        inject: [TASK_REPOSITORY_TOKEN],
    },
    {
        provide: GetTaskTimelineUseCase,
        useFactory: (events: IEventRepository) => new GetTaskTimelineUseCase(events),
        inject: [EVENT_REPOSITORY_TOKEN],
    },
    {
        provide: GetTaskTurnsUseCase,
        useFactory: (turns: ITurnQueryRepository) => new GetTaskTurnsUseCase(turns),
        inject: [TURN_QUERY_REPOSITORY_TOKEN],
    },
    {
        provide: GetTaskLatestRuntimeSessionUseCase,
        useFactory: (runtimeBindings: IRuntimeBindingLookup) =>
            new GetTaskLatestRuntimeSessionUseCase(runtimeBindings),
        inject: [RUNTIME_BINDING_LOOKUP],
    },
    {
        provide: GetTaskOpenInferenceUseCase,
        useFactory: (tasks: ITaskRepository, events: IEventRepository) =>
            new GetTaskOpenInferenceUseCase(tasks, events),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
    },
];

export const TASK_APPLICATION_EXPORTS = [
    TaskLifecycleService,
    StartTaskUseCase,
    CompleteTaskUseCase,
    ErrorTaskUseCase,
    UpdateTaskUseCase,
    LinkTaskUseCase,
    DeleteTaskUseCase,
    DeleteFinishedTasksUseCase,
    ListTasksUseCase,
    GetTaskUseCase,
    GetTaskTimelineUseCase,
    GetTaskTurnsUseCase,
    GetTaskLatestRuntimeSessionUseCase,
    GetTaskOpenInferenceUseCase,
] as const;
