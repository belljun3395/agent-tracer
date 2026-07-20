import { describe, expect, it } from "vitest";
import { TaskUserStateEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/task/port/__fakes__/fixed.clock.js";
import { InMemoryTaskUserStateRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.user.state.repository.js";
import type { TaskSearchIndexPort } from "~tracer-api/domain/task/port/task.search.index.port.js";
import { TaskUserStateService } from "./task.user.state.service.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

interface Harness {
    readonly service: TaskUserStateService;
    stored(taskId: string): TaskUserStateEntity | undefined;
    readonly indexed: Record<string, unknown>[];
}

function makeService(seed: readonly TaskUserStateEntity[] = []): Harness {
    const repo = new InMemoryTaskUserStateRepository();
    repo.seed(...seed);
    const indexed: Record<string, unknown>[] = [];
    const search = {
        partialUpdate: async (taskId: string, doc: Record<string, unknown>) => {
            indexed.push({ taskId, ...doc });
        },
    } satisfies TaskSearchIndexPort;
    return {
        service: new TaskUserStateService(repo, search, new FixedClock(NOW)),
        stored: (taskId) => repo.all().find((state) => state.taskId === taskId),
        indexed,
    };
}

function archivedState(taskId: string, userId: string): TaskUserStateEntity {
    const state = TaskUserStateEntity.init(taskId, userId, NOW);
    state.archive(NOW);
    return state;
}

describe("TaskUserStateService", () => {
    it("상태가 없던 태스크를 보관하면 상태를 만들어 저장하고 색인에 반영한다", async () => {
        const harness = makeService();

        await harness.service.archive("u1", "t1");

        expect(harness.stored("t1")?.isArchived()).toBe(true);
        expect(harness.stored("t1")?.userId).toBe("u1");
        expect(harness.indexed).toEqual([{ taskId: "t1", archived: true }]);
    });

    it("보관을 해제하면 색인의 보관 표시도 내린다", async () => {
        const harness = makeService([archivedState("t1", "u1")]);

        await harness.service.unarchive("u1", "t1");

        expect(harness.stored("t1")?.isArchived()).toBe(false);
        expect(harness.indexed).toEqual([{ taskId: "t1", archived: false }]);
    });

    it("숨기면 상태와 색인 양쪽에 숨김을 남긴다", async () => {
        const harness = makeService([TaskUserStateEntity.init("t1", "u1", NOW)]);

        await harness.service.hide("u1", "t1");

        expect(harness.stored("t1")?.isHidden()).toBe(true);
        expect(harness.indexed).toEqual([{ taskId: "t1", hidden: true }]);
    });

    it("여러 태스크를 한꺼번에 숨기면 각각의 상태와 색인에 숨김을 남긴다", async () => {
        const harness = makeService();

        await harness.service.hideAll("u1", ["t1", "t2"]);

        expect(harness.stored("t1")?.isHidden()).toBe(true);
        expect(harness.stored("t2")?.isHidden()).toBe(true);
        expect(harness.indexed).toEqual([
            { taskId: "t1", hidden: true },
            { taskId: "t2", hidden: true },
        ]);
    });

});
