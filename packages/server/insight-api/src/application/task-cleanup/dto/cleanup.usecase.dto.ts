import type { TaskCleanupSuggestionKind } from "@monitor/insight-api/domain/task-cleanup/const/task.cleanup.const.js";

export type CleanupSuggestionStatusFilter = "pending" | "all";

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
