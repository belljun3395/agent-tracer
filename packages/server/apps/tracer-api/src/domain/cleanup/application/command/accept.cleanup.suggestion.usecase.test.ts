import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CLEANUP_SUGGESTION_STATUS, TASK_CLEANUP_SUGGESTION_KIND } from "@monitor/kernel";
import {
    InvariantViolationError,
    SEARCH_OUTBOX_TARGET,
    TaskCleanupSuggestionEntity,
    TaskEntity,
    TaskUserStateEntity,
} from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/cleanup/port/__fakes__/fixed.clock.js";
import { InMemoryCleanupTransaction } from "~tracer-api/domain/cleanup/port/__fakes__/in-memory.cleanup.transaction.js";
import { AcceptCleanupSuggestionUseCase } from "./accept.cleanup.suggestion.usecase.js";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function suggestion(overrides: Partial<TaskCleanupSuggestionEntity> = {}): TaskCleanupSuggestionEntity {
    const entity = new TaskCleanupSuggestionEntity();
    entity.id = "s1";
    entity.userId = "u1";
    entity.jobId = "j1";
    entity.taskId = "t1";
    entity.kind = TASK_CLEANUP_SUGGESTION_KIND.archive;
    entity.currentValue = null;
    entity.proposedValue = null;
    entity.rationale = "이벤트가 없다";
    entity.status = CLEANUP_SUGGESTION_STATUS.pending;
    entity.error = null;
    entity.createdAt = new Date("2026-01-01T00:00:00.000Z");
    entity.resolvedAt = null;
    entity.observedLastEventAt = null;
    Object.assign(entity, overrides);
    return entity;
}

function task(overrides: Partial<TaskEntity> = {}): TaskEntity {
    const entity = new TaskEntity();
    entity.id = "t1";
    entity.userId = "u1";
    entity.title = "태스크";
    entity.slug = "t1";
    entity.workspacePath = null;
    entity.status = "completed";
    entity.taskKind = "primary";
    entity.origin = "user";
    entity.cliSource = null;
    entity.parentTaskId = null;
    entity.parentSessionId = null;
    entity.backgroundOfTaskId = null;
    entity.createdAt = new Date("2026-01-01T00:00:00.000Z");
    entity.updatedAt = new Date("2026-01-01T00:00:00.000Z");
    entity.lastSessionStartedAt = null;
    entity.lastEventAt = null;
    Object.assign(entity, overrides);
    return entity;
}

function makeUseCase(seed: {
    readonly suggestions?: readonly TaskCleanupSuggestionEntity[];
    readonly tasks?: readonly TaskEntity[];
    readonly states?: readonly TaskUserStateEntity[];
}): { readonly useCase: AcceptCleanupSuggestionUseCase; readonly tx: InMemoryCleanupTransaction } {
    const tx = new InMemoryCleanupTransaction();
    tx.cleanupSuggestions.seed(...(seed.suggestions ?? []));
    tx.tasks.seed(...(seed.tasks ?? []));
    tx.taskUserStates.seed(...(seed.states ?? []));
    return { useCase: new AcceptCleanupSuggestionUseCase(tx, clock), tx };
}

describe("AcceptCleanupSuggestionUseCase", () => {
    it("남의 제안은 찾을 수 없다고 응답한다", async () => {
        const { useCase, tx } = makeUseCase({ suggestions: [suggestion({ userId: "u2" })] });

        await expect(useCase.execute("u1", "s1")).rejects.toBeInstanceOf(NotFoundException);
        expect(tx.taskUserStates.all()).toHaveLength(0);
    });

    it("자기 제안은 수락하고 태스크를 보관한 뒤 검색 아웃박스에 반영 요청을 남긴다", async () => {
        const { useCase, tx } = makeUseCase({
            suggestions: [suggestion()],
            tasks: [task({ lastEventAt: null })],
        });

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
        const state = tx.taskUserStates.all().find((s) => s.taskId === "t1");
        expect(state?.isArchived()).toBe(true);
        const outboxRows = tx.searchOutbox.all();
        expect(outboxRows).toHaveLength(1);
        expect(outboxRows[0]).toMatchObject({ target: SEARCH_OUTBOX_TARGET.task, targetId: "t1", userId: "u1" });
    });

    it("제안을 만든 뒤 태스크에 새 활동이 생겼으면 수락을 conflict로 거부한다", async () => {
        const { useCase, tx } = makeUseCase({
            suggestions: [suggestion({ observedLastEventAt: new Date("2026-01-01T00:00:00.000Z") })],
            tasks: [task({ lastEventAt: new Date("2026-01-02T00:00:00.000Z") })],
        });

        await expect(useCase.execute("u1", "s1")).rejects.toThrow(InvariantViolationError);
        expect(tx.taskUserStates.all()).toHaveLength(0);
        expect(tx.searchOutbox.all()).toHaveLength(0);
    });

    it("관찰 시점 이후 활동이 없으면 그대로 수락한다", async () => {
        const observedAt = new Date("2026-01-01T00:00:00.000Z");
        const { useCase } = makeUseCase({
            suggestions: [suggestion({ observedLastEventAt: observedAt })],
            tasks: [task({ lastEventAt: observedAt })],
        });

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
    });

    it("이미 수락된 제안을 다시 수락해도 같은 결과를 반환하고 아웃박스를 다시 적재하지 않는다", async () => {
        const accepted = suggestion({
            status: CLEANUP_SUGGESTION_STATUS.accepted,
            resolvedAt: new Date("2026-01-02T00:00:00.000Z"),
        });
        const archivedState = TaskUserStateEntity.init("t1", "u1", new Date("2026-01-02T00:00:00.000Z"));
        archivedState.archive(new Date("2026-01-02T00:00:00.000Z"));
        const { useCase, tx } = makeUseCase({
            suggestions: [accepted],
            tasks: [task({ lastEventAt: new Date("2026-01-05T00:00:00.000Z") })],
            states: [archivedState],
        });

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
        expect(tx.searchOutbox.all()).toHaveLength(0);
    });

    it("이미 보관된 작업은 다시 보관하지 않고 아웃박스에도 적재하지 않는다", async () => {
        const archivedState = TaskUserStateEntity.init("t1", "u1", new Date("2026-01-01T00:00:00.000Z"));
        archivedState.archive(new Date("2026-01-01T00:00:00.000Z"));
        const { useCase, tx } = makeUseCase({
            suggestions: [suggestion()],
            tasks: [task()],
            states: [archivedState],
        });

        const result = await useCase.execute("u1", "s1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
        expect(tx.searchOutbox.all()).toHaveLength(0);
    });

    it("보관 처리 중 하나라도 실패하면 트랜잭션 전체가 롤백돼 제안이 pending으로 남는다", async () => {
        const { useCase, tx } = makeUseCase({ suggestions: [suggestion()], tasks: [task()] });
        tx.taskUserStates.saveFailure = new Error("db down");

        await expect(useCase.execute("u1", "s1")).rejects.toThrow("db down");

        const stored = tx.cleanupSuggestions.all().find((s) => s.id === "s1");
        expect(stored?.status).toBe(CLEANUP_SUGGESTION_STATUS.pending);
    });
});
