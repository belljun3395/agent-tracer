import type {
    BriefingFormat,
    BriefingPurpose,
    ReusableTaskSnapshot,
    SavedBriefing,
} from "~domain/workflow/index.js";
import type {
    TaskEvaluation,
    WorkflowSearchResult,
    WorkflowSummary,
} from "~domain/workflow/index.js";
export type { SavedBriefing, TaskEvaluation, WorkflowSearchResult, WorkflowSummary };
export interface StoredTaskEvaluation extends TaskEvaluation {
    readonly workflowSnapshot: ReusableTaskSnapshot | null;
    readonly workflowContext: string | null;
    readonly searchText: string | null;
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: WorkflowSummary["qualitySignals"];
}
export interface WorkflowContentRecord {
    readonly snapshotId: string;
    readonly taskId: string;
    readonly scopeKey: string;
    readonly scopeKind: "task" | "turn";
    readonly scopeLabel: string;
    readonly turnIndex: number | null;
    readonly title: string;
    readonly displayTitle?: string;
    readonly workflowSnapshot: ReusableTaskSnapshot;
    readonly workflowContext: string;
    readonly searchText: string | null;
    readonly source: "saved" | "generated";
    readonly version: number;
    readonly promotedTo: string | null;
    readonly qualitySignals: WorkflowSummary["qualitySignals"];
}
export interface PersistedTaskEvaluation extends TaskEvaluation {
    readonly workflowSnapshot?: ReusableTaskSnapshot | null;
    readonly workflowContext?: string | null;
    readonly searchText?: string | null;
}
export interface BriefingSaveInput {
    readonly purpose: BriefingPurpose;
    readonly format: BriefingFormat;
    readonly memo?: string | null;
    readonly content: string;
    readonly generatedAt: string;
}
export interface IEvaluationRepository {
    upsertEvaluation(evaluation: PersistedTaskEvaluation): Promise<void>;
    recordBriefingCopy(taskId: string, copiedAt: string, scopeKey?: string): Promise<void>;
    saveBriefing(taskId: string, briefing: BriefingSaveInput): Promise<SavedBriefing>;
    listBriefings(taskId: string): Promise<readonly SavedBriefing[]>;
    getEvaluation(taskId: string, scopeKey?: string): Promise<StoredTaskEvaluation | null>;
    getWorkflowContent(taskId: string, scopeKey?: string): Promise<WorkflowContentRecord | null>;
    listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]>;
    searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number): Promise<readonly WorkflowSummary[]>;
    searchSimilarWorkflows(query: string, tags?: readonly string[], limit?: number): Promise<readonly WorkflowSearchResult[]>;
}
