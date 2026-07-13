import type { TaskCleanupSuggestionStatus } from "@monitor/kernel";
import type { TaskCleanupSuggestionEntity } from "@monitor/tracer-domain";
import type { CleanupSuggestionRepositoryPort } from "~tracer-api/domain/cleanup/port/cleanup.suggestion.repository.port.js";
import { cloneRow } from "./clone-row.js";

/** 정리 제안 포트의 인메모리 대역이다. */
export class InMemoryCleanupSuggestionRepository implements CleanupSuggestionRepositoryPort {
    private rows = new Map<string, TaskCleanupSuggestionEntity>();

    seed(...suggestions: readonly TaskCleanupSuggestionEntity[]): void {
        for (const suggestion of suggestions) this.rows.set(suggestion.id, suggestion);
    }

    all(): readonly TaskCleanupSuggestionEntity[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, TaskCleanupSuggestionEntity> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, TaskCleanupSuggestionEntity>): void {
        this.rows = snapshot;
    }

    findById(id: string): Promise<TaskCleanupSuggestionEntity | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }

    findByUserStatus(userId: string, status: TaskCleanupSuggestionStatus): Promise<TaskCleanupSuggestionEntity[]> {
        const rows = this.all()
            .filter((row) => row.userId === userId && row.status === status)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .map(cloneRow);
        return Promise.resolve(rows);
    }

    upsert(suggestion: TaskCleanupSuggestionEntity): Promise<void> {
        this.rows.set(suggestion.id, suggestion);
        return Promise.resolve();
    }
}
