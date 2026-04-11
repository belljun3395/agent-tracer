import type { TaskId } from "../monitoring/ids.js";
export type WorkflowLayer = "snapshot" | "playbook";
export type PlaybookStatus = "draft" | "active" | "archived";
export type BriefingPurpose = "continue" | "handoff" | "review" | "reference";
export type BriefingFormat = "plain" | "markdown" | "xml" | "system-prompt";

export interface QualitySignals {
    readonly reuseCount: number;
    readonly lastReusedAt: string | null;
    readonly briefingCopyCount: number;
    readonly manualRating: "good" | "skip";
}

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
    readonly layer: "snapshot";
    readonly taskId: TaskId;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: "good" | "skip";
    readonly eventCount: number;
    readonly createdAt: string;
    readonly evaluatedAt: string;
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: QualitySignals;
}

export interface WorkflowSearchResult extends WorkflowEvaluationData {
    readonly layer: "snapshot";
    readonly taskId: TaskId;
    readonly title: string;
    readonly displayTitle?: string;
    readonly rating: "good" | "skip";
    readonly eventCount: number;
    readonly createdAt: string;
    readonly workflowContext: string;
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: QualitySignals;
}

export interface PlaybookVariant {
    readonly label: string;
    readonly description: string;
    readonly differenceFromBase: string;
}

export interface PlaybookSummary {
    readonly layer: "playbook";
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: PlaybookStatus;
    readonly whenToUse: string | null;
    readonly tags: readonly string[];
    readonly useCount: number;
    readonly lastUsedAt: string | null;
    readonly sourceSnapshotIds: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface PlaybookRecord extends PlaybookSummary {
    readonly prerequisites: readonly string[];
    readonly approach: string | null;
    readonly keySteps: readonly string[];
    readonly watchouts: readonly string[];
    readonly antiPatterns: readonly string[];
    readonly failureModes: readonly string[];
    readonly variants: readonly PlaybookVariant[];
    readonly relatedPlaybookIds: readonly string[];
    readonly searchText: string | null;
}

export type KnowledgeItemSummary = WorkflowSummary | PlaybookSummary;

export interface SavedBriefing {
    readonly id: string;
    readonly taskId: TaskId;
    readonly generatedAt: string;
    readonly purpose: BriefingPurpose;
    readonly format: BriefingFormat;
    readonly memo: string | null;
    readonly content: string;
}

export type QuestionPhase = "asked" | "answered" | "concluded";
export type TodoState = "added" | "in_progress" | "completed" | "cancelled";
