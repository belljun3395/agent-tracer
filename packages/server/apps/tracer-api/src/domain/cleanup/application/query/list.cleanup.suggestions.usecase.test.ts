import { describe, expect, it } from "vitest";
import { CLEANUP_SUGGESTION_STATUS, TASK_CLEANUP_SUGGESTION_KIND } from "@monitor/kernel";
import { TaskCleanupSuggestionEntity } from "@monitor/tracer-domain";
import { InMemoryCleanupSuggestionRepository } from "~tracer-api/domain/cleanup/port/__fakes__/in-memory.cleanup.suggestion.repository.js";
import { ListCleanupSuggestionsUseCase } from "./list.cleanup.suggestions.usecase.js";

const NOW = new Date("2026-07-08T00:00:00.000Z");

describe("ListCleanupSuggestionsUseCase", () => {
    it("대기 중인 동일 task/kind 제안은 최신 하나만 반환한다", async () => {
        const repo = new InMemoryCleanupSuggestionRepository();
        repo.seed(...suggestions);
        const useCase = new ListCleanupSuggestionsUseCase(repo);

        const result = await useCase.execute("u1", CLEANUP_SUGGESTION_STATUS.pending);

        expect(result.items.map((item) => item.id)).toEqual(["new-task-1", "task-2"]);
    });
});

const suggestions = [
    suggestion("old-task-1", "task-1", "u1", "job-old", -60_000),
    suggestion("new-task-1", "task-1", "u1", "job-new", 0),
    suggestion("task-2", "task-2", "u1", "job-new", -1_000),
    suggestion("other-user", "task-1", "u2", "job-new", 0),
];

function suggestion(
    id: string,
    taskId: string,
    userId: string,
    jobId: string,
    offsetMs: number,
): TaskCleanupSuggestionEntity {
    const entity = new TaskCleanupSuggestionEntity();
    entity.id = id;
    entity.userId = userId;
    entity.jobId = jobId;
    entity.taskId = taskId;
    entity.kind = TASK_CLEANUP_SUGGESTION_KIND.archive;
    entity.currentValue = null;
    entity.proposedValue = JSON.stringify({ archive: true });
    entity.rationale = "중복";
    entity.status = CLEANUP_SUGGESTION_STATUS.pending;
    entity.error = null;
    entity.createdAt = new Date(NOW.getTime() + offsetMs);
    entity.resolvedAt = null;
    return entity;
}
