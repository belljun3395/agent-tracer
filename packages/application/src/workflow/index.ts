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
} from "@monitor/domain";
export type {
    BuildReusableTaskSnapshotInput,
    TurnSegment,
} from "@monitor/domain";
