import type { TaskId } from "../monitoring/ids.js";

export interface WorkflowEvaluationData {
    readonly useCase: string | null;
    readonly workflowTags: readonly string[];
    readonly outcomeNote: string | null;
    readonly approachNote: string | null;
    readonly reuseWhen: string | null;
    readonly watchouts: string | null;
}

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
    readonly searchText: string;
}

export interface TaskEvaluation extends WorkflowEvaluationData {
    readonly taskId: TaskId;
    readonly rating: "good" | "skip";
    readonly evaluatedAt: string;
}

export interface WorkflowSummary extends WorkflowEvaluationData {
    readonly taskId: TaskId;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: "good" | "skip";
    readonly eventCount: number;
    readonly createdAt: string;
    readonly evaluatedAt: string;
}

export interface WorkflowSearchResult extends WorkflowEvaluationData {
    readonly taskId: TaskId;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: "good" | "skip";
    readonly eventCount: number;
    readonly createdAt: string;
    readonly workflowContext: string;
}

export type QuestionPhase = "asked" | "answered" | "concluded";
export type TodoState = "added" | "in_progress" | "completed" | "cancelled";
