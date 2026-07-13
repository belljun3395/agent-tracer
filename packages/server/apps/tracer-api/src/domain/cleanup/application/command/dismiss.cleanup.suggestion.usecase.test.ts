import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CLEANUP_SUGGESTION_STATUS, TASK_CLEANUP_SUGGESTION_KIND } from "@monitor/kernel";
import { InvariantViolationError, TaskCleanupSuggestionEntity } from "@monitor/tracer-domain";
import { InMemoryCleanupSuggestionRepository } from "~tracer-api/domain/cleanup/port/__fakes__/in-memory.cleanup.suggestion.repository.js";
import { DismissCleanupSuggestionUseCase } from "./dismiss.cleanup.suggestion.usecase.js";

function suggestion(status: (typeof CLEANUP_SUGGESTION_STATUS)[keyof typeof CLEANUP_SUGGESTION_STATUS]): TaskCleanupSuggestionEntity {
    const entity = new TaskCleanupSuggestionEntity();
    entity.id = "s1";
    entity.userId = "u1";
    entity.jobId = "j1";
    entity.taskId = "t1";
    entity.kind = TASK_CLEANUP_SUGGESTION_KIND.archive;
    entity.currentValue = null;
    entity.proposedValue = null;
    entity.rationale = "이벤트가 없다";
    entity.status = status;
    entity.error = null;
    entity.createdAt = new Date("2026-01-01T00:00:00.000Z");
    entity.resolvedAt = null;
    return entity;
}

function makeUseCase(suggestions: TaskCleanupSuggestionEntity[]): DismissCleanupSuggestionUseCase {
    const repo = new InMemoryCleanupSuggestionRepository();
    repo.seed(...suggestions);
    return new DismissCleanupSuggestionUseCase(repo);
}

describe("DismissCleanupSuggestionUseCase", () => {
    it("존재하지 않는 제안을 기각하려 하면 NotFound를 던진다", async () => {
        const useCase = makeUseCase([]);

        await expect(useCase.execute("u1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("이미 처리된 제안을 다시 기각하려 하면 도메인 예외가 그대로 전파된다", async () => {
        const useCase = makeUseCase([suggestion(CLEANUP_SUGGESTION_STATUS.accepted)]);

        await expect(useCase.execute("u1", "s1")).rejects.toThrow(InvariantViolationError);
    });

    it("대기 중인 제안을 기각한다", async () => {
        const useCase = makeUseCase([suggestion(CLEANUP_SUGGESTION_STATUS.pending)]);

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.dismissed);
    });
});
