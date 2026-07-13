import type { TaskCleanupSuggestionKind, TaskCleanupSuggestionStatus } from "./cleanup.const.js";

export interface CleanupSuggestionDto {
    readonly id: string;
    readonly userId: string;
    readonly jobId: string;
    readonly taskId: string;
    readonly kind: TaskCleanupSuggestionKind;
    readonly currentValue: string | null;
    readonly proposedValue: string | null;
    readonly rationale: string;
    readonly status: TaskCleanupSuggestionStatus;
    readonly error: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
}
