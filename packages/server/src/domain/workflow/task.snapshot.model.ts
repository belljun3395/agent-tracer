
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
