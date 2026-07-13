import { Inject, Injectable } from "@nestjs/common";
import {
    CLEANUP_SUGGESTION_STATUS,
    CLEANUP_SUGGESTION_STATUSES,
    type TaskCleanupSuggestionStatus,
} from "@monitor/kernel";
import type { TaskCleanupSuggestionEntity } from "@monitor/tracer-domain";
import {
    CLEANUP_SUGGESTION_REPOSITORY,
    type CleanupSuggestionRepositoryPort,
} from "~tracer-api/domain/cleanup/port/cleanup.suggestion.repository.port.js";
import { mapCleanupSuggestion, type CleanupSuggestionDto } from "~tracer-api/domain/cleanup/model/cleanup.model.js";

@Injectable()
export class ListCleanupSuggestionsUseCase {
    constructor(
        @Inject(CLEANUP_SUGGESTION_REPOSITORY)
        private readonly suggestions: CleanupSuggestionRepositoryPort,
    ) {}

    async execute(userId: string, status?: TaskCleanupSuggestionStatus): Promise<{ readonly items: readonly CleanupSuggestionDto[] }> {
        const rows = dedupePendingByTaskKind(await this.collect(userId, status));
        return { items: rows.map(mapCleanupSuggestion) };
    }

    private async collect(userId: string, status: TaskCleanupSuggestionStatus | undefined): Promise<TaskCleanupSuggestionEntity[]> {
        if (status !== undefined) return this.suggestions.findByUserStatus(userId, status);
        const groups = await Promise.all(CLEANUP_SUGGESTION_STATUSES.map((s) => this.suggestions.findByUserStatus(userId, s)));
        return groups.flat();
    }
}

function dedupePendingByTaskKind(rows: readonly TaskCleanupSuggestionEntity[]): TaskCleanupSuggestionEntity[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
        if (row.status !== CLEANUP_SUGGESTION_STATUS.pending) return true;
        const key = `${row.taskId}:${row.kind}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
