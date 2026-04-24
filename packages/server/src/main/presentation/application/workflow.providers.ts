import type { Provider } from "@nestjs/common";
import type {
    IEvaluationRepository,
    IEventRepository,
    IPlaybookRepository,
    ITaskRepository,
} from "~application/index.js";
import {
    CreatePlaybookUseCase,
    GetPlaybookUseCase,
    GetTaskEvaluationUseCase,
    GetWorkflowContentUseCase,
    ListBriefingsUseCase,
    ListEvaluationsUseCase,
    ListPlaybooksUseCase,
    RecordBriefingCopyUseCase,
    SaveBriefingUseCase,
    SearchSimilarWorkflowsUseCase,
    SearchWorkflowLibraryUseCase,
    UpdatePlaybookUseCase,
    UpsertTaskEvaluationUseCase,
} from "~application/workflow/usecases.index.js";
import {
    EVALUATION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    PLAYBOOK_REPOSITORY_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const WORKFLOW_APPLICATION_PROVIDERS: Provider[] = [
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
];

export const WORKFLOW_APPLICATION_EXPORTS = [
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
] as const;
