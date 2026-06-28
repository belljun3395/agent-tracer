export interface DismissCleanupSuggestionUseCaseIn {
    readonly suggestionId: string;
}

export interface DismissCleanupSuggestionUseCaseOut {
    readonly status: "dismissed" | "not_found" | "not_pending";
}
