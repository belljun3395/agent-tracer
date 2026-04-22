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
