import type { Provider } from "@nestjs/common";
import type {
    IEvaluationRepository,
    IEventRepository,
    ITaskRepository,
} from "~application/index.js";
import {
    GetTaskEvaluationUseCase,
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchSimilarWorkflowsUseCase,
    SearchWorkflowLibraryUseCase,
    UpsertTaskEvaluationUseCase,
} from "~application/workflow/index.js";
import {
    EVALUATION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
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
];

export const WORKFLOW_APPLICATION_EXPORTS = [
    UpsertTaskEvaluationUseCase,
    GetTaskEvaluationUseCase,
    GetWorkflowContentUseCase,
    ListEvaluationsUseCase,
    SearchWorkflowLibraryUseCase,
    SearchSimilarWorkflowsUseCase,
] as const;
