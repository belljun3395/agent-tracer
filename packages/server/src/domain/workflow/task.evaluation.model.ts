import type { WorkflowLayer, WorkflowRating } from "./task.evaluation.type.js";

export interface QualitySignals {
    readonly reuseCount: number;
    readonly lastReusedAt: string | null;
    readonly briefingCopyCount: number;
    readonly manualRating: WorkflowRating;
}

export interface WorkflowEvaluationData {
    readonly useCase: string | null;
    readonly workflowTags: readonly string[];
    readonly outcomeNote: string | null;
    readonly approachNote: string | null;
    readonly reuseWhen: string | null;
    readonly watchouts: string | null;
}

export interface TaskEvaluation extends WorkflowEvaluationData {
    readonly taskId: string;
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
    readonly rating: WorkflowRating;
    readonly evaluatedAt: string;
}

export interface WorkflowSummary extends WorkflowEvaluationData {
    readonly layer: Extract<WorkflowLayer, "snapshot">;
    readonly snapshotId: string;
    readonly taskId: string;
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: WorkflowRating;
    readonly eventCount: number;
    readonly createdAt: string;
    readonly evaluatedAt: string;
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: QualitySignals;
}

export interface WorkflowSearchResult extends WorkflowEvaluationData {
    readonly layer: Extract<WorkflowLayer, "snapshot">;
    readonly snapshotId: string;
    readonly taskId: string;
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: WorkflowRating;
    readonly eventCount: number;
    readonly createdAt: string;
    readonly workflowContext: string;
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: QualitySignals;
}
