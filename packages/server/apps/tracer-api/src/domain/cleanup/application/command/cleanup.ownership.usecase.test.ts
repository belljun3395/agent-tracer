import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CLEANUP_SUGGESTION_STATUS, TASK_CLEANUP_SUGGESTION_KIND } from "@monitor/kernel";
import { TaskCleanupSuggestionEntity, TaskEntity } from "@monitor/tracer-domain";
import { InMemoryCleanupSuggestionRepository } from "~tracer-api/domain/cleanup/port/__fakes__/in-memory.cleanup.suggestion.repository.js";
import { InMemoryCleanupTransaction } from "~tracer-api/domain/cleanup/port/__fakes__/in-memory.cleanup.transaction.js";
import { AcceptCleanupSuggestionUseCase } from "./accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "./dismiss.cleanup.suggestion.usecase.js";

describe("AcceptCleanupSuggestionUseCase", () => {
    it("남의 제안은 찾을 수 없다고 응답한다", async () => {
        const { useCase, tx } = buildAccept(suggestionOf("u2"));

        await expect(useCase.execute("u1", "s1")).rejects.toBeInstanceOf(NotFoundException);
        expect(tx.taskUserStates.all()).toHaveLength(0);
    });

    it("자기 제안은 수락하고 태스크를 보관한다", async () => {
        const { useCase, tx } = buildAccept(suggestionOf("u1"));

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
        expect(tx.taskUserStates.all().find((s) => s.taskId === "t1")?.isArchived()).toBe(true);
    });
});

describe("DismissCleanupSuggestionUseCase", () => {
    it("남의 제안은 찾을 수 없다고 응답한다", async () => {
        const { useCase, suggestions } = buildDismiss(suggestionOf("u2"));

        await expect(useCase.execute("u1", "s1")).rejects.toBeInstanceOf(NotFoundException);
        expect(suggestions.all()[0]?.status).toBe(CLEANUP_SUGGESTION_STATUS.pending);
    });

    it("자기 제안은 기각한다", async () => {
        const { useCase } = buildDismiss(suggestionOf("u1"));

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.dismissed);
    });
});

function buildAccept(entity: TaskCleanupSuggestionEntity) {
    const tx = new InMemoryCleanupTransaction();
    tx.cleanupSuggestions.seed(entity);
    tx.tasks.seed(taskOf(entity.taskId));
    return { useCase: new AcceptCleanupSuggestionUseCase(tx), tx };
}

function buildDismiss(entity: TaskCleanupSuggestionEntity) {
    const suggestions = new InMemoryCleanupSuggestionRepository();
    suggestions.seed(entity);
    return { useCase: new DismissCleanupSuggestionUseCase(suggestions), suggestions };
}

function suggestionOf(userId: string): TaskCleanupSuggestionEntity {
    const entity = new TaskCleanupSuggestionEntity();
    entity.id = "s1";
    entity.userId = userId;
    entity.jobId = "j1";
    entity.taskId = "t1";
    entity.kind = TASK_CLEANUP_SUGGESTION_KIND.archive;
    entity.currentValue = null;
    entity.proposedValue = null;
    entity.rationale = "이벤트가 없다";
    entity.status = CLEANUP_SUGGESTION_STATUS.pending;
    entity.error = null;
    entity.createdAt = new Date("2026-07-10T00:00:00.000Z");
    entity.resolvedAt = null;
    entity.observedLastEventAt = null;
    return entity;
}

function taskOf(taskId: string): TaskEntity {
    const entity = new TaskEntity();
    entity.id = taskId;
    entity.userId = "u1";
    entity.title = "태스크";
    entity.slug = taskId;
    entity.workspacePath = null;
    entity.status = "completed";
    entity.taskKind = "primary";
    entity.origin = "user";
    entity.cliSource = null;
    entity.parentTaskId = null;
    entity.parentSessionId = null;
    entity.backgroundOfTaskId = null;
    entity.createdAt = new Date("2026-07-10T00:00:00.000Z");
    entity.updatedAt = new Date("2026-07-10T00:00:00.000Z");
    entity.lastSessionStartedAt = null;
    entity.lastEventAt = null;
    return entity;
}
