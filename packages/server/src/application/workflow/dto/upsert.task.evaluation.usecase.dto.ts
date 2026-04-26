export type UpsertTaskEvaluationRatingUseCaseDto = "good" | "skip";

export interface ReusableTaskSnapshotUseCaseDto {
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

export interface UpsertTaskEvaluationUseCaseIn {
    readonly taskId: string;
    readonly scopeKey?: string;
    readonly rating: UpsertTaskEvaluationRatingUseCaseDto;
    readonly useCase?: string;
    readonly workflowTags?: string[];
    readonly outcomeNote?: string;
    readonly approachNote?: string;
    readonly reuseWhen?: string;
    readonly watchouts?: string;
    readonly workflowSnapshot?: ReusableTaskSnapshotUseCaseDto | null;
    readonly workflowContext?: string;
}

export type UpsertTaskEvaluationUseCaseOut = void;
