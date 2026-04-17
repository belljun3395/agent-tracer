import type { BriefingFormat, BriefingPurpose, PlaybookRecord, PlaybookStatus, PlaybookSummary, ReusableTaskSnapshot, SavedBriefing, TaskEvaluation, TaskId, WorkflowSearchResult, WorkflowSummary } from "@monitor/domain";
export type { PlaybookRecord, PlaybookSummary, SavedBriefing, TaskEvaluation, WorkflowSearchResult, WorkflowSummary };
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
    readonly taskId: TaskId;
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
export interface PlaybookUpsertInput {
    readonly title: string;
    readonly status?: PlaybookStatus;
    readonly whenToUse?: string | null;
    readonly prerequisites?: readonly string[];
    readonly approach?: string | null;
    readonly keySteps?: readonly string[];
    readonly watchouts?: readonly string[];
    readonly antiPatterns?: readonly string[];
    readonly failureModes?: readonly string[];
    readonly variants?: PlaybookRecord["variants"];
    readonly relatedPlaybookIds?: readonly string[];
    readonly sourceSnapshotIds?: readonly string[];
    readonly tags?: readonly string[];
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
    recordBriefingCopy(taskId: TaskId, copiedAt: string, scopeKey?: string): Promise<void>;
    saveBriefing(taskId: TaskId, briefing: BriefingSaveInput): Promise<SavedBriefing>;
    listBriefings(taskId: TaskId): Promise<readonly SavedBriefing[]>;
    getEvaluation(taskId: TaskId, scopeKey?: string): Promise<StoredTaskEvaluation | null>;
    getWorkflowContent(taskId: TaskId, scopeKey?: string): Promise<WorkflowContentRecord | null>;
    listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]>;
    searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number): Promise<readonly WorkflowSummary[]>;
    searchSimilarWorkflows(query: string, tags?: readonly string[], limit?: number): Promise<readonly WorkflowSearchResult[]>;
    listPlaybooks(query?: string, status?: PlaybookStatus, limit?: number): Promise<readonly PlaybookSummary[]>;
    getPlaybook(playbookId: string): Promise<PlaybookRecord | null>;
    createPlaybook(input: PlaybookUpsertInput): Promise<PlaybookRecord>;
    updatePlaybook(playbookId: string, input: Partial<PlaybookUpsertInput>): Promise<PlaybookRecord | null>;
}
