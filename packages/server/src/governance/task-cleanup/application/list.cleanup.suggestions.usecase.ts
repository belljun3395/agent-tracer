import { Injectable } from "@nestjs/common";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type {
    CleanupSuggestionDto,
    ListCleanupSuggestionsUseCaseIn,
    ListCleanupSuggestionsUseCaseOut,
} from "./dto/cleanup.usecase.dto.js";
import type { TaskCleanupSuggestionEntity } from "../domain/task.cleanup.suggestion.entity.js";

@Injectable()
export class ListCleanupSuggestionsUseCase {
    constructor(private readonly suggestions: TaskCleanupSuggestionRepository) {}

    async execute(
        input: ListCleanupSuggestionsUseCaseIn,
    ): Promise<ListCleanupSuggestionsUseCaseOut> {
        const scope = input.status ?? "pending";
        const rows =
            scope === "pending"
                ? await this.suggestions.listByStatus("pending")
                : await this.suggestions.listAll();
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
