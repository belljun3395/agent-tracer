import type {
    CleanupSuggestionDto,
    CleanupSuggestionStatusFilter,
} from "@monitor/insight-api/application/task-cleanup/dto/cleanup.usecase.dto.js";

export type { CleanupSuggestionDto };

export interface ListCleanupSuggestionsUseCaseIn {
    readonly status?: CleanupSuggestionStatusFilter;
}

export interface ListCleanupSuggestionsUseCaseOut {
    readonly suggestions: readonly CleanupSuggestionDto[];
}
