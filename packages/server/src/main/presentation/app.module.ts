import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import {
    IngestController,
    EventController,
    LifecycleController,
    BookmarkWriteController,
    EvaluationWriteController,
    TypedIngestController,
} from "~adapters/http/ingest/index.js";
import {
    AdminController,
    BookmarkController,
    EvaluationController,
    SearchController,
} from "~adapters/http/query/index.js";
import type { MonitorPorts } from "~application/index.js";
import {
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
    DeleteBookmarkUseCase,
} from "~application/bookmarks/index.js";
import {
    EndSessionUseCase,
    EnsureRuntimeSessionUseCase,
    EndRuntimeSessionUseCase,
    ResolveRuntimeBindingUseCase,
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
} from "~application/workflow/usecases.index.js";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database/database.provider.js";

export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: MonitorPorts["notifier"];
}

@Module({})
export class AppModule {
    static forRoot(options: AppModuleOptions): DynamicModule {
        const dbProvider = DatabaseProvider(options);

        // Bookmark UseCases
        const listBookmarksProvider: Provider = {
            provide: ListBookmarksUseCase,
            useFactory: (ports: MonitorPorts) => new ListBookmarksUseCase(ports.bookmarks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const saveBookmarkProvider: Provider = {
            provide: SaveBookmarkUseCase,
            useFactory: (ports: MonitorPorts) =>
                new SaveBookmarkUseCase(ports.tasks, ports.events, ports.bookmarks, ports.notifier),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const deleteBookmarkProvider: Provider = {
            provide: DeleteBookmarkUseCase,
            useFactory: (ports: MonitorPorts) => new DeleteBookmarkUseCase(ports.bookmarks, ports.notifier),
            inject: [MONITOR_PORTS_TOKEN],
        };

        // Session UseCases
        const endSessionProvider: Provider = {
            provide: EndSessionUseCase,
            useFactory: (ports: MonitorPorts) => new EndSessionUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const ensureRuntimeSessionProvider: Provider = {
            provide: EnsureRuntimeSessionUseCase,
            useFactory: (ports: MonitorPorts) => new EnsureRuntimeSessionUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const endRuntimeSessionProvider: Provider = {
            provide: EndRuntimeSessionUseCase,
            useFactory: (ports: MonitorPorts) => new EndRuntimeSessionUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const resolveRuntimeBindingProvider: Provider = {
            provide: ResolveRuntimeBindingUseCase,
            useFactory: (ports: MonitorPorts) =>
                new ResolveRuntimeBindingUseCase(ports.runtimeBindings, ports.sessions),
            inject: [MONITOR_PORTS_TOKEN],
        };

        // Event UseCases
        const logEventProvider: Provider = {
            provide: LogEventUseCase,
            useFactory: (ports: MonitorPorts) =>
                new LogEventUseCase(ports.tasks, ports.events, ports.notifier),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const updateEventProvider: Provider = {
            provide: UpdateEventUseCase,
            useFactory: (ports: MonitorPorts) => new UpdateEventUseCase(ports.events, ports.notifier),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const ingestEventsProvider: Provider = {
            provide: IngestEventsUseCase,
            useFactory: (logEvent: LogEventUseCase) => new IngestEventsUseCase(logEvent),
            inject: [LogEventUseCase],
        };
        const searchEventsProvider: Provider = {
            provide: SearchEventsUseCase,
            useFactory: (ports: MonitorPorts) => new SearchEventsUseCase(ports.events),
            inject: [MONITOR_PORTS_TOKEN],
        };

        // Observability UseCases
        const getOverviewProvider: Provider = {
            provide: GetOverviewUseCase,
            useFactory: (ports: MonitorPorts) => new GetOverviewUseCase(ports.tasks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getObservabilityOverviewProvider: Provider = {
            provide: GetObservabilityOverviewUseCase,
            useFactory: (ports: MonitorPorts) =>
                new GetObservabilityOverviewUseCase(ports.tasks, ports.sessions, ports.events),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskObservabilityProvider: Provider = {
            provide: GetTaskObservabilityUseCase,
            useFactory: (ports: MonitorPorts) =>
                new GetTaskObservabilityUseCase(ports.tasks, ports.sessions, ports.events),
            inject: [MONITOR_PORTS_TOKEN],
        };

        // Task lifecycle UseCases
        const startTaskProvider: Provider = {
            provide: StartTaskUseCase,
            useFactory: (ports: MonitorPorts) => new StartTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const completeTaskProvider: Provider = {
            provide: CompleteTaskUseCase,
            useFactory: (ports: MonitorPorts) => new CompleteTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const errorTaskProvider: Provider = {
            provide: ErrorTaskUseCase,
            useFactory: (ports: MonitorPorts) => new ErrorTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const updateTaskProvider: Provider = {
            provide: UpdateTaskUseCase,
            useFactory: (ports: MonitorPorts) => new UpdateTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const linkTaskProvider: Provider = {
            provide: LinkTaskUseCase,
            useFactory: (ports: MonitorPorts) => new LinkTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const deleteTaskProvider: Provider = {
            provide: DeleteTaskUseCase,
            useFactory: (ports: MonitorPorts) => new DeleteTaskUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const deleteFinishedTasksProvider: Provider = {
            provide: DeleteFinishedTasksUseCase,
            useFactory: (ports: MonitorPorts) => new DeleteFinishedTasksUseCase(ports),
            inject: [MONITOR_PORTS_TOKEN],
        };

        // Task query UseCases
        const listTasksProvider: Provider = {
            provide: ListTasksUseCase,
            useFactory: (ports: MonitorPorts) => new ListTasksUseCase(ports.tasks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskProvider: Provider = {
            provide: GetTaskUseCase,
            useFactory: (ports: MonitorPorts) => new GetTaskUseCase(ports.tasks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskTimelineProvider: Provider = {
            provide: GetTaskTimelineUseCase,
            useFactory: (ports: MonitorPorts) => new GetTaskTimelineUseCase(ports.events),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskLatestRuntimeSessionProvider: Provider = {
            provide: GetTaskLatestRuntimeSessionUseCase,
            useFactory: (ports: MonitorPorts) => new GetTaskLatestRuntimeSessionUseCase(ports.runtimeBindings),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskOpenInferenceProvider: Provider = {
            provide: GetTaskOpenInferenceUseCase,
            useFactory: (ports: MonitorPorts) => new GetTaskOpenInferenceUseCase(ports.tasks, ports.events),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getDefaultWorkspacePathProvider: Provider = {
            provide: GetDefaultWorkspacePathUseCase,
            useFactory: () => new GetDefaultWorkspacePathUseCase(),
            inject: [],
        };

        // Workflow UseCases
        const upsertTaskEvaluationProvider: Provider = {
            provide: UpsertTaskEvaluationUseCase,
            useFactory: (ports: MonitorPorts) =>
                new UpsertTaskEvaluationUseCase(ports.tasks, ports.events, ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getTaskEvaluationProvider: Provider = {
            provide: GetTaskEvaluationUseCase,
            useFactory: (ports: MonitorPorts) => new GetTaskEvaluationUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const recordBriefingCopyProvider: Provider = {
            provide: RecordBriefingCopyUseCase,
            useFactory: (ports: MonitorPorts) => new RecordBriefingCopyUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const saveBriefingProvider: Provider = {
            provide: SaveBriefingUseCase,
            useFactory: (ports: MonitorPorts) => new SaveBriefingUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const listBriefingsProvider: Provider = {
            provide: ListBriefingsUseCase,
            useFactory: (ports: MonitorPorts) => new ListBriefingsUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getWorkflowContentProvider: Provider = {
            provide: GetWorkflowContentUseCase,
            useFactory: (ports: MonitorPorts) => new GetWorkflowContentUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const listEvaluationsProvider: Provider = {
            provide: ListEvaluationsUseCase,
            useFactory: (ports: MonitorPorts) => new ListEvaluationsUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const searchWorkflowLibraryProvider: Provider = {
            provide: SearchWorkflowLibraryUseCase,
            useFactory: (ports: MonitorPorts) => new SearchWorkflowLibraryUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const searchSimilarWorkflowsProvider: Provider = {
            provide: SearchSimilarWorkflowsUseCase,
            useFactory: (ports: MonitorPorts) => new SearchSimilarWorkflowsUseCase(ports.evaluations),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const listPlaybooksProvider: Provider = {
            provide: ListPlaybooksUseCase,
            useFactory: (ports: MonitorPorts) => new ListPlaybooksUseCase(ports.playbooks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const getPlaybookProvider: Provider = {
            provide: GetPlaybookUseCase,
            useFactory: (ports: MonitorPorts) => new GetPlaybookUseCase(ports.playbooks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const createPlaybookProvider: Provider = {
            provide: CreatePlaybookUseCase,
            useFactory: (ports: MonitorPorts) => new CreatePlaybookUseCase(ports.playbooks),
            inject: [MONITOR_PORTS_TOKEN],
        };
        const updatePlaybookProvider: Provider = {
            provide: UpdatePlaybookUseCase,
            useFactory: (ports: MonitorPorts) => new UpdatePlaybookUseCase(ports.playbooks),
            inject: [MONITOR_PORTS_TOKEN],
        };

        return {
            module: AppModule,
            imports: [],
            providers: [
                dbProvider,
                listBookmarksProvider,
                saveBookmarkProvider,
                deleteBookmarkProvider,
                endSessionProvider,
                ensureRuntimeSessionProvider,
                endRuntimeSessionProvider,
                resolveRuntimeBindingProvider,
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
            ],
            exports: [MONITOR_PORTS_TOKEN],
        };
    }
}
