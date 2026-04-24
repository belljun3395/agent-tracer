import type { Provider } from "@nestjs/common";
import type {
    IBookmarkRepository,
    IEvaluationRepository,
    IEventRepository,
    INotificationPublisher,
    IPlaybookRepository,
    IRuleCommandRepository,
    IRuntimeBindingRepository,
    ISessionRepository,
    ITaskRepository,
    ITurnPartitionRepository,
} from "~application/index.js";
import {
    DeleteBookmarkUseCase,
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
} from "~application/bookmarks/index.js";
import {
    IngestEventsUseCase,
    LogEventUseCase,
    SearchEventsUseCase,
    UpdateEventUseCase,
} from "~application/events/index.js";
import {
    GetObservabilityOverviewUseCase,
    GetOverviewUseCase,
    GetTaskObservabilityUseCase,
} from "~application/index.js";
import {
    CreateRuleCommandUseCase,
    DeleteRuleCommandUseCase,
    GetRulePatternsUseCase,
    ListRuleCommandsUseCase,
} from "~application/rule-commands/index.js";
import {
    EndRuntimeSessionUseCase,
    EnsureRuntimeSessionUseCase,
} from "~application/sessions/index.js";
import {
    CompleteTaskUseCase,
    DeleteFinishedTasksUseCase,
    DeleteTaskUseCase,
    ErrorTaskUseCase,
    GetDefaultWorkspacePathUseCase,
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
    CreatePlaybookUseCase,
    GetPlaybookUseCase,
    GetTaskEvaluationUseCase,
    GetTurnPartitionUseCase,
    GetWorkflowContentUseCase,
    ListBriefingsUseCase,
    ListEvaluationsUseCase,
    ListPlaybooksUseCase,
    RecordBriefingCopyUseCase,
    ResetTurnPartitionUseCase,
    SaveBriefingUseCase,
    SearchSimilarWorkflowsUseCase,
    SearchWorkflowLibraryUseCase,
    UpdatePlaybookUseCase,
    UpsertTaskEvaluationUseCase,
    UpsertTurnPartitionUseCase,
} from "~application/workflow/usecases.index.js";
import {
    BOOKMARK_REPOSITORY_TOKEN,
    EVALUATION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    PLAYBOOK_REPOSITORY_TOKEN,
    RULE_COMMAND_REPOSITORY_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
    TURN_PARTITION_REPOSITORY_TOKEN,
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

const bookmarkProviders: Provider[] = [
    {
        provide: ListBookmarksUseCase,
        useFactory: (bookmarks: IBookmarkRepository) => new ListBookmarksUseCase(bookmarks),
        inject: [BOOKMARK_REPOSITORY_TOKEN],
    },
    {
        provide: SaveBookmarkUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            bookmarks: IBookmarkRepository,
            notifier: INotificationPublisher,
        ) => new SaveBookmarkUseCase(tasks, events, bookmarks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: DeleteBookmarkUseCase,
        useFactory: (bookmarks: IBookmarkRepository, notifier: INotificationPublisher) =>
            new DeleteBookmarkUseCase(bookmarks, notifier),
        inject: [BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
];

const sessionProviders: Provider[] = [
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

const eventProviders: Provider[] = [
    {
        provide: LogEventUseCase,
        useFactory: (tasks: ITaskRepository, events: IEventRepository, notifier: INotificationPublisher) =>
            new LogEventUseCase(tasks, events, notifier),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: UpdateEventUseCase,
        useFactory: (events: IEventRepository, notifier: INotificationPublisher) =>
            new UpdateEventUseCase(events, notifier),
        inject: [EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: IngestEventsUseCase,
        useFactory: (logEvent: LogEventUseCase) => new IngestEventsUseCase(logEvent),
        inject: [LogEventUseCase],
    },
    {
        provide: SearchEventsUseCase,
        useFactory: (events: IEventRepository) => new SearchEventsUseCase(events),
        inject: [EVENT_REPOSITORY_TOKEN],
    },
];

const observabilityProviders: Provider[] = [
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
        provide: GetTaskObservabilityUseCase,
        useFactory: (tasks: ITaskRepository, sessions: ISessionRepository, events: IEventRepository) =>
            new GetTaskObservabilityUseCase(tasks, sessions, events),
        inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
    },
];

const taskProviders: Provider[] = [
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
    {
        provide: GetDefaultWorkspacePathUseCase,
        useFactory: () => new GetDefaultWorkspacePathUseCase(),
        inject: [],
    },
];

const workflowProviders: Provider[] = [
    {
        provide: UpsertTaskEvaluationUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            evaluations: IEvaluationRepository,
        ) => new UpsertTaskEvaluationUseCase(tasks, events, evaluations),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: GetTaskEvaluationUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new GetTaskEvaluationUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: RecordBriefingCopyUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new RecordBriefingCopyUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: SaveBriefingUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new SaveBriefingUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: ListBriefingsUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new ListBriefingsUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: GetWorkflowContentUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new GetWorkflowContentUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: ListEvaluationsUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new ListEvaluationsUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: SearchWorkflowLibraryUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new SearchWorkflowLibraryUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: SearchSimilarWorkflowsUseCase,
        useFactory: (evaluations: IEvaluationRepository) => new SearchSimilarWorkflowsUseCase(evaluations),
        inject: [EVALUATION_REPOSITORY_TOKEN],
    },
    {
        provide: ListPlaybooksUseCase,
        useFactory: (playbooks: IPlaybookRepository) => new ListPlaybooksUseCase(playbooks),
        inject: [PLAYBOOK_REPOSITORY_TOKEN],
    },
    {
        provide: GetPlaybookUseCase,
        useFactory: (playbooks: IPlaybookRepository) => new GetPlaybookUseCase(playbooks),
        inject: [PLAYBOOK_REPOSITORY_TOKEN],
    },
    {
        provide: CreatePlaybookUseCase,
        useFactory: (playbooks: IPlaybookRepository) => new CreatePlaybookUseCase(playbooks),
        inject: [PLAYBOOK_REPOSITORY_TOKEN],
    },
    {
        provide: UpdatePlaybookUseCase,
        useFactory: (playbooks: IPlaybookRepository) => new UpdatePlaybookUseCase(playbooks),
        inject: [PLAYBOOK_REPOSITORY_TOKEN],
    },
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

const ruleCommandProviders: Provider[] = [
    {
        provide: CreateRuleCommandUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new CreateRuleCommandUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: DeleteRuleCommandUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new DeleteRuleCommandUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: ListRuleCommandsUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new ListRuleCommandsUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
    {
        provide: GetRulePatternsUseCase,
        useFactory: (ruleCommands: IRuleCommandRepository) => new GetRulePatternsUseCase(ruleCommands),
        inject: [RULE_COMMAND_REPOSITORY_TOKEN],
    },
];

export const APPLICATION_PROVIDERS: Provider[] = [
    taskLifecycleProvider,
    ...bookmarkProviders,
    ...sessionProviders,
    ...eventProviders,
    ...observabilityProviders,
    ...taskProviders,
    ...workflowProviders,
    ...ruleCommandProviders,
];

export const APPLICATION_PROVIDER_TOKENS = [
    TaskLifecycleService,
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
    DeleteBookmarkUseCase,
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
    LogEventUseCase,
    UpdateEventUseCase,
    IngestEventsUseCase,
    SearchEventsUseCase,
    GetOverviewUseCase,
    GetObservabilityOverviewUseCase,
    GetTaskObservabilityUseCase,
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
    GetDefaultWorkspacePathUseCase,
    UpsertTaskEvaluationUseCase,
    GetTaskEvaluationUseCase,
    RecordBriefingCopyUseCase,
    SaveBriefingUseCase,
    ListBriefingsUseCase,
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchWorkflowLibraryUseCase,
    SearchSimilarWorkflowsUseCase,
    ListPlaybooksUseCase,
    GetPlaybookUseCase,
    CreatePlaybookUseCase,
    UpdatePlaybookUseCase,
    GetTurnPartitionUseCase,
    UpsertTurnPartitionUseCase,
    ResetTurnPartitionUseCase,
    CreateRuleCommandUseCase,
    DeleteRuleCommandUseCase,
    ListRuleCommandsUseCase,
    GetRulePatternsUseCase,
] as const;
