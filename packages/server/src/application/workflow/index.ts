// Pure workflow helpers were promoted to @monitor/domain so browser-side
// consumers (web-*) can call them without depending on the application
// layer. Re-exported here to keep the application-layer import surface
// unchanged for server/adapter callers.
export {
    buildReusableTaskSnapshot,
    buildWorkflowContext,
    buildPlanSection,
    buildLaneSections,
    buildModifiedFilesSection,
    buildOpenTodoSection,
    buildVerificationSummarySection,
    segmentEventsByTurn,
    filterEventsByTurnRange,
    buildDefaultPartition,
    countNonPreludeTurns,
    mergeAdjacentGroups,
    resolveTurnPartition,
    setGroupLabel,
    setGroupVisibility,
    splitGroup,
    validatePartition,
} from "~domain/index.js";
export type {
    BuildReusableTaskSnapshotInput,
    TurnSegment,
    TurnGroup,
    TurnPartition,
} from "~domain/index.js";

// Use cases
export { UpsertTaskEvaluationUseCase } from "./upsert.task.evaluation.usecase.js";
export type { UpsertTaskEvaluationUseCaseIn } from "./upsert.task.evaluation.usecase.js";
export { GetTaskEvaluationUseCase } from "./get.task.evaluation.usecase.js";
export { GetWorkflowContentUseCase } from "./get.workflow.content.usecase.js";
export { ListEvaluationsUseCase } from "./list.evaluations.usecase.js";
export { SearchWorkflowLibraryUseCase } from "./search.workflow.library.usecase.js";
export { SearchSimilarWorkflowsUseCase } from "./search.similar.workflows.usecase.js";
export { GetTurnPartitionUseCase } from "./get.turn.partition.usecase.js";
export { UpsertTurnPartitionUseCase } from "./upsert.turn.partition.usecase.js";
export type { UpsertTurnPartitionInput } from "./upsert.turn.partition.usecase.js";
export { ResetTurnPartitionUseCase } from "./reset.turn.partition.usecase.js";
export { TaskNotFoundError, TurnPartitionVersionMismatchError } from "./workflow.errors.js";
