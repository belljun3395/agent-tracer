import type { TaskCleanupSuggestionKind } from "@monitor/governance-api/task-cleanup/domain/task.cleanup.suggestion.entity.js";

export interface EnqueueCleanupScanUseCaseOut {
    readonly jobId: string;
    readonly status: string;
    readonly createdAt: string;
}

export interface AcceptCleanupSuggestionUseCaseIn {
    readonly suggestionId: string;
}

export interface AcceptCleanupSuggestionUseCaseOut {
    readonly status: "accepted" | "not_found" | "not_pending" | "apply_failed";
    readonly error?: string;
}

export interface DismissCleanupSuggestionUseCaseIn {
    readonly suggestionId: string;
}

export interface DismissCleanupSuggestionUseCaseOut {
    readonly status: "dismissed" | "not_found" | "not_pending";
}

export type CleanupSuggestionStatusFilter = "pending" | "all";

export interface ListCleanupSuggestionsUseCaseIn {
    readonly status?: CleanupSuggestionStatusFilter;
}

export interface CleanupSuggestionDto {
    readonly id: string;
    readonly jobId: string;
    readonly taskId: string;
    readonly kind: TaskCleanupSuggestionKind;
    readonly currentValue: unknown;
    readonly proposedValue: unknown;
    readonly rationale: string;
    readonly status: "pending" | "accepted" | "dismissed" | "failed";
    readonly error?: string;
    readonly createdAt: string;
    readonly resolvedAt?: string;
}

export interface ListCleanupSuggestionsUseCaseOut {
    readonly suggestions: readonly CleanupSuggestionDto[];
}
