import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import {
    IngestController,
    EventController,
    LifecycleController,
    BookmarkWriteController,
    EvaluationWriteController,
    TypedIngestController,
    RuleCommandWriteController,
    TurnPartitionWriteController,
} from "~adapters/http/ingest/index.js";
import {
    AdminController,
    BookmarkController,
    EvaluationController,
    SearchController,
    RuleCommandController,
    TurnPartitionController,
} from "~adapters/http/query/index.js";
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
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
    DeleteBookmarkUseCase,
} from "~application/bookmarks/index.js";
import {
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
} from "~application/sessions/index.js";
import {
    LogEventUseCase,
    UpdateEventUseCase,
    IngestEventsUseCase,
    SearchEventsUseCase,
} from "~application/events/index.js";
import {
    GetOverviewUseCase,
    GetObservabilityOverviewUseCase,
    GetTaskObservabilityUseCase,
} from "~application/index.js";
import {
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
} from "~application/tasks/index.js";
import {
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
} from "~application/workflow/usecases.index.js";
import {
    CreateRuleCommandUseCase,
    DeleteRuleCommandUseCase,
    ListRuleCommandsUseCase,
    GetRulePatternsUseCase,
} from "~application/rule-commands/index.js";
import {
    BOOKMARK_REPOSITORY_TOKEN,
    DATABASE_PORT_TOKENS,
    DatabaseProviders,
    EVALUATION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    PLAYBOOK_REPOSITORY_TOKEN,
    RULE_COMMAND_REPOSITORY_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
    TURN_PARTITION_REPOSITORY_TOKEN,
} from "./database/database.provider.js";

export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class AppModule {
    static forRoot(options: AppModuleOptions): DynamicModule {
        const databaseProviders = DatabaseProviders(options);

        // Bookmark UseCases
        const listBookmarksProvider: Provider = {
            provide: ListBookmarksUseCase,
            useFactory: (bookmarks: IBookmarkRepository) => new ListBookmarksUseCase(bookmarks),
            inject: [BOOKMARK_REPOSITORY_TOKEN],
        };
        const saveBookmarkProvider: Provider = {
            provide: SaveBookmarkUseCase,
            useFactory: (
                tasks: ITaskRepository,
                events: IEventRepository,
                bookmarks: IBookmarkRepository,
                notifier: INotificationPublisher,
            ) => new SaveBookmarkUseCase(tasks, events, bookmarks, notifier),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const deleteBookmarkProvider: Provider = {
            provide: DeleteBookmarkUseCase,
            useFactory: (bookmarks: IBookmarkRepository, notifier: INotificationPublisher) =>
                new DeleteBookmarkUseCase(bookmarks, notifier),
            inject: [BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };

        // Session UseCases
        const ensureRuntimeSessionProvider: Provider = {
            provide: EnsureRuntimeSessionUseCase,
            useFactory: (
                tasks: ITaskRepository,
                sessions: ISessionRepository,
                events: IEventRepository,
                runtimeBindings: IRuntimeBindingRepository,
                notifier: INotificationPublisher,
            ) => new EnsureRuntimeSessionUseCase(tasks, sessions, events, runtimeBindings, notifier),
            inject: [
                TASK_REPOSITORY_TOKEN,
                SESSION_REPOSITORY_TOKEN,
                EVENT_REPOSITORY_TOKEN,
                RUNTIME_BINDING_REPOSITORY_TOKEN,
                NOTIFICATION_PUBLISHER_TOKEN,
            ],
        };
        const endRuntimeSessionProvider: Provider = {
            provide: EndRuntimeSessionUseCase,
            useFactory: (
                tasks: ITaskRepository,
                sessions: ISessionRepository,
                events: IEventRepository,
                runtimeBindings: IRuntimeBindingRepository,
                notifier: INotificationPublisher,
            ) => new EndRuntimeSessionUseCase(tasks, sessions, events, runtimeBindings, notifier),
            inject: [
                TASK_REPOSITORY_TOKEN,
                SESSION_REPOSITORY_TOKEN,
                EVENT_REPOSITORY_TOKEN,
                RUNTIME_BINDING_REPOSITORY_TOKEN,
                NOTIFICATION_PUBLISHER_TOKEN,
            ],
        };
        // Event UseCases
        const logEventProvider: Provider = {
            provide: LogEventUseCase,
            useFactory: (tasks: ITaskRepository, events: IEventRepository, notifier: INotificationPublisher) =>
                new LogEventUseCase(tasks, events, notifier),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const updateEventProvider: Provider = {
            provide: UpdateEventUseCase,
            useFactory: (events: IEventRepository, notifier: INotificationPublisher) =>
                new UpdateEventUseCase(events, notifier),
            inject: [EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const ingestEventsProvider: Provider = {
            provide: IngestEventsUseCase,
            useFactory: (logEvent: LogEventUseCase) => new IngestEventsUseCase(logEvent),
            inject: [LogEventUseCase],
        };
        const searchEventsProvider: Provider = {
            provide: SearchEventsUseCase,
            useFactory: (events: IEventRepository) => new SearchEventsUseCase(events),
            inject: [EVENT_REPOSITORY_TOKEN],
        };

        // Observability UseCases
        const getOverviewProvider: Provider = {
            provide: GetOverviewUseCase,
            useFactory: (tasks: ITaskRepository) => new GetOverviewUseCase(tasks),
            inject: [TASK_REPOSITORY_TOKEN],
        };
        const getObservabilityOverviewProvider: Provider = {
            provide: GetObservabilityOverviewUseCase,
            useFactory: (tasks: ITaskRepository, sessions: ISessionRepository, events: IEventRepository) =>
                new GetObservabilityOverviewUseCase(tasks, sessions, events),
            inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
        };
        const getTaskObservabilityProvider: Provider = {
            provide: GetTaskObservabilityUseCase,
            useFactory: (tasks: ITaskRepository, sessions: ISessionRepository, events: IEventRepository) =>
                new GetTaskObservabilityUseCase(tasks, sessions, events),
            inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
        };

        // Task lifecycle UseCases
        const startTaskProvider: Provider = {
            provide: StartTaskUseCase,
            useFactory: (
                tasks: ITaskRepository,
                sessions: ISessionRepository,
                events: IEventRepository,
                notifier: INotificationPublisher,
            ) => new StartTaskUseCase(tasks, sessions, events, notifier),
            inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const completeTaskProvider: Provider = {
            provide: CompleteTaskUseCase,
            useFactory: (
                tasks: ITaskRepository,
                sessions: ISessionRepository,
                events: IEventRepository,
                notifier: INotificationPublisher,
            ) => new CompleteTaskUseCase(tasks, sessions, events, notifier),
            inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const errorTaskProvider: Provider = {
            provide: ErrorTaskUseCase,
            useFactory: (
                tasks: ITaskRepository,
                sessions: ISessionRepository,
                events: IEventRepository,
                notifier: INotificationPublisher,
            ) => new ErrorTaskUseCase(tasks, sessions, events, notifier),
            inject: [TASK_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const updateTaskProvider: Provider = {
            provide: UpdateTaskUseCase,
            useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
                new UpdateTaskUseCase(tasks, notifier),
            inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const linkTaskProvider: Provider = {
            provide: LinkTaskUseCase,
            useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
                new LinkTaskUseCase(tasks, notifier),
            inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const deleteTaskProvider: Provider = {
            provide: DeleteTaskUseCase,
            useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
                new DeleteTaskUseCase(tasks, notifier),
            inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };
        const deleteFinishedTasksProvider: Provider = {
            provide: DeleteFinishedTasksUseCase,
            useFactory: (tasks: ITaskRepository, notifier: INotificationPublisher) =>
                new DeleteFinishedTasksUseCase(tasks, notifier),
            inject: [TASK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
        };

        // Task query UseCases
        const listTasksProvider: Provider = {
            provide: ListTasksUseCase,
            useFactory: (tasks: ITaskRepository) => new ListTasksUseCase(tasks),
            inject: [TASK_REPOSITORY_TOKEN],
        };
        const getTaskProvider: Provider = {
            provide: GetTaskUseCase,
            useFactory: (tasks: ITaskRepository) => new GetTaskUseCase(tasks),
            inject: [TASK_REPOSITORY_TOKEN],
        };
        const getTaskTimelineProvider: Provider = {
            provide: GetTaskTimelineUseCase,
            useFactory: (events: IEventRepository) => new GetTaskTimelineUseCase(events),
            inject: [EVENT_REPOSITORY_TOKEN],
        };
        const getTaskLatestRuntimeSessionProvider: Provider = {
            provide: GetTaskLatestRuntimeSessionUseCase,
            useFactory: (runtimeBindings: IRuntimeBindingRepository) =>
                new GetTaskLatestRuntimeSessionUseCase(runtimeBindings),
            inject: [RUNTIME_BINDING_REPOSITORY_TOKEN],
        };
        const getTaskOpenInferenceProvider: Provider = {
            provide: GetTaskOpenInferenceUseCase,
            useFactory: (tasks: ITaskRepository, events: IEventRepository) =>
                new GetTaskOpenInferenceUseCase(tasks, events),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN],
        };
        const getDefaultWorkspacePathProvider: Provider = {
            provide: GetDefaultWorkspacePathUseCase,
            useFactory: () => new GetDefaultWorkspacePathUseCase(),
            inject: [],
        };

        // Workflow UseCases
        const upsertTaskEvaluationProvider: Provider = {
            provide: UpsertTaskEvaluationUseCase,
            useFactory: (
                tasks: ITaskRepository,
                events: IEventRepository,
                evaluations: IEvaluationRepository,
            ) => new UpsertTaskEvaluationUseCase(tasks, events, evaluations),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, EVALUATION_REPOSITORY_TOKEN],
        };
        const getTaskEvaluationProvider: Provider = {
            provide: GetTaskEvaluationUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new GetTaskEvaluationUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const recordBriefingCopyProvider: Provider = {
            provide: RecordBriefingCopyUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new RecordBriefingCopyUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const saveBriefingProvider: Provider = {
            provide: SaveBriefingUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new SaveBriefingUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const listBriefingsProvider: Provider = {
            provide: ListBriefingsUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new ListBriefingsUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const getWorkflowContentProvider: Provider = {
            provide: GetWorkflowContentUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new GetWorkflowContentUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const listEvaluationsProvider: Provider = {
            provide: ListEvaluationsUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new ListEvaluationsUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const searchWorkflowLibraryProvider: Provider = {
            provide: SearchWorkflowLibraryUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new SearchWorkflowLibraryUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const searchSimilarWorkflowsProvider: Provider = {
            provide: SearchSimilarWorkflowsUseCase,
            useFactory: (evaluations: IEvaluationRepository) => new SearchSimilarWorkflowsUseCase(evaluations),
            inject: [EVALUATION_REPOSITORY_TOKEN],
        };
        const listPlaybooksProvider: Provider = {
            provide: ListPlaybooksUseCase,
            useFactory: (playbooks: IPlaybookRepository) => new ListPlaybooksUseCase(playbooks),
            inject: [PLAYBOOK_REPOSITORY_TOKEN],
        };
        const getPlaybookProvider: Provider = {
            provide: GetPlaybookUseCase,
            useFactory: (playbooks: IPlaybookRepository) => new GetPlaybookUseCase(playbooks),
            inject: [PLAYBOOK_REPOSITORY_TOKEN],
        };
        const createPlaybookProvider: Provider = {
            provide: CreatePlaybookUseCase,
            useFactory: (playbooks: IPlaybookRepository) => new CreatePlaybookUseCase(playbooks),
            inject: [PLAYBOOK_REPOSITORY_TOKEN],
        };
        const updatePlaybookProvider: Provider = {
            provide: UpdatePlaybookUseCase,
            useFactory: (playbooks: IPlaybookRepository) => new UpdatePlaybookUseCase(playbooks),
            inject: [PLAYBOOK_REPOSITORY_TOKEN],
        };

        // Turn partition UseCases
        const getTurnPartitionProvider: Provider = {
            provide: GetTurnPartitionUseCase,
            useFactory: (
                tasks: ITaskRepository,
                events: IEventRepository,
                turnPartitions: ITurnPartitionRepository,
            ) => new GetTurnPartitionUseCase(tasks, events, turnPartitions),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
        };
        const upsertTurnPartitionProvider: Provider = {
            provide: UpsertTurnPartitionUseCase,
            useFactory: (
                tasks: ITaskRepository,
                events: IEventRepository,
                turnPartitions: ITurnPartitionRepository,
            ) => new UpsertTurnPartitionUseCase(tasks, events, turnPartitions),
            inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
        };
        const resetTurnPartitionProvider: Provider = {
            provide: ResetTurnPartitionUseCase,
            useFactory: (tasks: ITaskRepository, turnPartitions: ITurnPartitionRepository) =>
                new ResetTurnPartitionUseCase(tasks, turnPartitions),
            inject: [TASK_REPOSITORY_TOKEN, TURN_PARTITION_REPOSITORY_TOKEN],
        };

        // Rule Command UseCases
        const createRuleCommandProvider: Provider = {
            provide: CreateRuleCommandUseCase,
            useFactory: (ruleCommands: IRuleCommandRepository) => new CreateRuleCommandUseCase(ruleCommands),
            inject: [RULE_COMMAND_REPOSITORY_TOKEN],
        };
        const deleteRuleCommandProvider: Provider = {
            provide: DeleteRuleCommandUseCase,
            useFactory: (ruleCommands: IRuleCommandRepository) => new DeleteRuleCommandUseCase(ruleCommands),
            inject: [RULE_COMMAND_REPOSITORY_TOKEN],
        };
        const listRuleCommandsProvider: Provider = {
            provide: ListRuleCommandsUseCase,
            useFactory: (ruleCommands: IRuleCommandRepository) => new ListRuleCommandsUseCase(ruleCommands),
            inject: [RULE_COMMAND_REPOSITORY_TOKEN],
        };
        const getRulePatternsProvider: Provider = {
            provide: GetRulePatternsUseCase,
            useFactory: (ruleCommands: IRuleCommandRepository) => new GetRulePatternsUseCase(ruleCommands),
            inject: [RULE_COMMAND_REPOSITORY_TOKEN],
        };

        return {
            module: AppModule,
            imports: [],
            providers: [
                ...databaseProviders,
                listBookmarksProvider,
                saveBookmarkProvider,
                deleteBookmarkProvider,
                ensureRuntimeSessionProvider,
                endRuntimeSessionProvider,
                logEventProvider,
                updateEventProvider,
                ingestEventsProvider,
                searchEventsProvider,
                getOverviewProvider,
                getObservabilityOverviewProvider,
                getTaskObservabilityProvider,
                startTaskProvider,
                completeTaskProvider,
                errorTaskProvider,
                updateTaskProvider,
                linkTaskProvider,
                deleteTaskProvider,
                deleteFinishedTasksProvider,
                listTasksProvider,
                getTaskProvider,
                getTaskTimelineProvider,
                getTaskLatestRuntimeSessionProvider,
                getTaskOpenInferenceProvider,
                getDefaultWorkspacePathProvider,
                upsertTaskEvaluationProvider,
                getTaskEvaluationProvider,
                recordBriefingCopyProvider,
                saveBriefingProvider,
                listBriefingsProvider,
                getWorkflowContentProvider,
                listEvaluationsProvider,
                searchWorkflowLibraryProvider,
                searchSimilarWorkflowsProvider,
                listPlaybooksProvider,
                getPlaybookProvider,
                createPlaybookProvider,
                updatePlaybookProvider,
                createRuleCommandProvider,
                deleteRuleCommandProvider,
                listRuleCommandsProvider,
                getRulePatternsProvider,
                getTurnPartitionProvider,
                upsertTurnPartitionProvider,
                resetTurnPartitionProvider,
            ],
            controllers: [
                AdminController,
                BookmarkController,
                SearchController,
                EvaluationController,
                IngestController,
                TypedIngestController,
                EventController,
                LifecycleController,
                BookmarkWriteController,
                EvaluationWriteController,
                RuleCommandController,
                RuleCommandWriteController,
                TurnPartitionController,
                TurnPartitionWriteController,
            ],
            exports: [...DATABASE_PORT_TOKENS],
        };
    }
}
