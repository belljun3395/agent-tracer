import type { Provider } from "@nestjs/common";
import type {
    IEventRepository,
    INotificationPublisher,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
} from "~application/index.js";
import {
    CompleteTaskUseCase,
    DeleteFinishedTasksUseCase,
    DeleteTaskUseCase,
    ErrorTaskUseCase,
    GetTaskLatestRuntimeSessionUseCase,
    GetTaskOpenInferenceUseCase,
    GetTaskTimelineUseCase,
    GetTaskUseCase,
    LinkTaskUseCase,
    ListTasksUseCase,
    StartTaskUseCase,
    TaskLifecycleService,
    UpdateTaskUseCase,
} from "~application/tasks/index.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

const taskLifecycleProvider: Provider = {
    provide: TaskLifecycleService,
    useFactory: (
        tasks: ITaskRepository,
        sessions: ISessionRepository,
        events: IEventRepository,
        notifier: INotificationPublisher,
    ) => new TaskLifecycleService(tasks, sessions, events, notifier),
    inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
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
        provide: GetTaskLatestRuntimeSessionUseCase,
        useFactory: (runtimeBindings: IRuntimeBindingRepository) =>
            new GetTaskLatestRuntimeSessionUseCase(runtimeBindings),
        inject: [RUNTIME_BINDING_REPOSITORY_TOKEN],
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
    GetTaskLatestRuntimeSessionUseCase,
    GetTaskOpenInferenceUseCase,
] as const;
