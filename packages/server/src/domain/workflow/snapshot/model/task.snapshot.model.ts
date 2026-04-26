import type { TimelineEvent } from "~domain/monitoring/index.js";
import type { WorkflowEvaluationData } from "~domain/workflow/evaluation/model/task.evaluation.model.js";

export interface ReusableTaskSnapshot {
    readonly objective: string;
    readonly originalRequest: string | null;
    readonly outcomeSummary: string | null;
    readonly approachSummary: string | null;
    readonly reuseWhen: string | null;
    readonly watchItems: readonly string[];
    readonly keyDecisions: readonly string[];
    readonly nextSteps: readonly string[];
    readonly keyFiles: readonly string[];
    readonly modifiedFiles: readonly string[];
    readonly verificationSummary: string | null;
    readonly activeInstructions: readonly string[];
    readonly searchText: string;
}

export interface ReusableTaskSnapshotInput {
    readonly objective: string;
    readonly events: readonly TimelineEvent[];
    readonly evaluation?: Partial<WorkflowEvaluationData> | null;
}
