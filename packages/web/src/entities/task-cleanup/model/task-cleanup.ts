import type { TaskId } from "~web/shared/identity.js";

export type CleanupSuggestionKind = "archive";
export type CleanupSuggestionStatus = "pending" | "accepted" | "dismissed" | "failed";

export interface CleanupSuggestion {
  readonly id: string;
  readonly jobId: string;
  readonly taskId: TaskId;
  readonly kind: CleanupSuggestionKind;
  readonly currentValue: unknown;
  readonly proposedValue: unknown;
  readonly rationale: string;
  readonly status: CleanupSuggestionStatus;
  readonly error?: string;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

export interface CleanupSuggestionsResponse {
  readonly suggestions: readonly CleanupSuggestion[];
}
