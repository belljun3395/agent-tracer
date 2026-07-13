import type { TaskCleanupSuggestionEntity } from "@monitor/tracer-domain";
import type { CleanupSuggestionDto } from "@monitor/kernel";

export type { CleanupSuggestionDto };

export function mapCleanupSuggestion(suggestion: TaskCleanupSuggestionEntity): CleanupSuggestionDto {
    return {
        id: suggestion.id,
        userId: suggestion.userId,
        jobId: suggestion.jobId,
        taskId: suggestion.taskId,
        kind: suggestion.kind,
        currentValue: suggestion.currentValue,
        proposedValue: suggestion.proposedValue,
        rationale: suggestion.rationale,
        status: suggestion.status,
        error: suggestion.error,
        createdAt: suggestion.createdAt.toISOString(),
        resolvedAt: suggestion.resolvedAt !== null ? suggestion.resolvedAt.toISOString() : null,
    };
}
