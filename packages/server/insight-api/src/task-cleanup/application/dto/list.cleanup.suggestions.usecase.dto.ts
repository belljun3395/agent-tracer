import type {
    CleanupSuggestionDto,
    CleanupSuggestionStatusFilter,
} from "./cleanup.usecase.dto.js";

export type { CleanupSuggestionDto };

export interface ListCleanupSuggestionsUseCaseIn {
    readonly status?: CleanupSuggestionStatusFilter;
}

export interface ListCleanupSuggestionsUseCaseOut {
    readonly suggestions: readonly CleanupSuggestionDto[];
}
