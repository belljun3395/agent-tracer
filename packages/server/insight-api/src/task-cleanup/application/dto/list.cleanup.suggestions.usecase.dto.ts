import type {
    CleanupSuggestionDto,
    CleanupSuggestionStatusFilter,
} from "./cleanup.usecase.dto.js";

export interface ListCleanupSuggestionsUseCaseIn {
    readonly status?: CleanupSuggestionStatusFilter;
}

export interface ListCleanupSuggestionsUseCaseOut {
    readonly suggestions: readonly CleanupSuggestionDto[];
}
