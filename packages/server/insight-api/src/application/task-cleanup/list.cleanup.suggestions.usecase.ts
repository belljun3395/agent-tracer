import { Injectable } from "@nestjs/common";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { TaskCleanupSuggestionRepository } from "@monitor/insight-api/repository/task-cleanup/task.cleanup.suggestion.repository.js";
import type {
    CleanupSuggestionDto,
    ListCleanupSuggestionsUseCaseIn,
    ListCleanupSuggestionsUseCaseOut,
} from "@monitor/insight-api/application/task-cleanup/dto/list.cleanup.suggestions.usecase.dto.js";
import type { TaskCleanupSuggestionEntity } from "@monitor/insight-api/domain/task-cleanup/task.cleanup.suggestion.entity.js";

@Injectable()
export class ListCleanupSuggestionsUseCase {
    constructor(private readonly suggestions: TaskCleanupSuggestionRepository) {}

    async execute(
        input: ListCleanupSuggestionsUseCaseIn,
    ): Promise<ListCleanupSuggestionsUseCaseOut> {
        const userId = currentUserId();
        const scope = input.status ?? "pending";
        const rows =
            scope === "pending"
                ? await this.suggestions.listByStatus("pending", userId)
                : await this.suggestions.listAll(userId);
        return { suggestions: rows.map(toDto) };
    }
}

function toDto(row: TaskCleanupSuggestionEntity): CleanupSuggestionDto {
    return {
        id: row.id,
        jobId: row.jobId,
        taskId: row.taskId,
        kind: row.kind,
        currentValue: row.currentValue ? safeJsonParse(row.currentValue) : null,
        proposedValue: row.proposedValue ? safeJsonParse(row.proposedValue) : null,
        rationale: row.rationale,
        status: row.status,
        ...(row.error ? { error: row.error } : {}),
        createdAt: row.createdAt,
        ...(row.resolvedAt ? { resolvedAt: row.resolvedAt } : {}),
    };
}

function safeJsonParse(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}
