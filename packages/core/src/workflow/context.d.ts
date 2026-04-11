import type { TimelineEvent } from "../monitoring/types.js";
import type { ReusableTaskSnapshot, WorkflowEvaluationData } from "./types.js";
/**
 * Builds the reusable markdown context block used to summarize a task workflow.
 */
export declare function buildWorkflowContext(events: readonly TimelineEvent[], taskTitle: string, evaluation?: Partial<WorkflowEvaluationData> | null, snapshotOverride?: ReusableTaskSnapshot | null): string;
/**
 * Renders planning-lane events as the workflow's explicit plan section.
 */
export declare function buildPlanSection(events: readonly TimelineEvent[]): string | undefined;
/**
 * Groups non-planning events into lane-specific markdown sections.
 */
export declare function buildLaneSections(events: readonly TimelineEvent[]): readonly string[];
/**
 * Lists files that were actually written during the workflow.
 */
export declare function buildModifiedFilesSection(events: readonly TimelineEvent[]): string | undefined;
/**
 * Surfaces TODO items that remain unresolved at the end of the workflow.
 */
export declare function buildOpenTodoSection(events: readonly TimelineEvent[]): string | undefined;
/**
 * Summarizes verification and rule outcomes, including any failing checks.
 */
export declare function buildVerificationSummarySection(events: readonly TimelineEvent[]): string | undefined;
//# sourceMappingURL=context.d.ts.map