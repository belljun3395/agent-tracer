export interface AcceptCleanupSuggestionUseCaseIn {
    readonly suggestionId: string;
}

export interface AcceptCleanupSuggestionUseCaseOut {
    readonly status: "accepted" | "not_found" | "not_pending" | "apply_failed";
    readonly error?: string;
}
