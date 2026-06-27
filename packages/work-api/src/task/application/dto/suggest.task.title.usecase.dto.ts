export interface SuggestTaskTitleUseCaseIn {
    readonly taskId: string;
}

export interface SuggestTaskTitleProposalDto {
    readonly title: string;
    readonly rationale: string;
}

export interface SuggestTaskTitleUseCaseOut {
    readonly suggestions: readonly SuggestTaskTitleProposalDto[];
    readonly modelUsed?: string;
    readonly durationMs?: number;
}
