import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TaskEntity } from "@monitor/tracer-domain";
import { FixedClock } from "~tracer-api/domain/task/port/__fakes__/fixed.clock.js";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import type { TaskSearchIndexPort } from "~tracer-api/domain/task/port/task.search.index.port.js";
import { RenameTaskUseCase } from "./rename.task.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeTask(id: string, title: string, titleRank: TaskEntity["titleRank"]): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = "u1";
    task.title = title;
    task.titleRank = titleRank;
    task.slug = title;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = null;
    task.cliSource = null;
    task.parentTaskId = null;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = NOW;
    task.updatedAt = NOW;
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

function makeUseCase(tasks: readonly TaskEntity[]): {
    useCase: RenameTaskUseCase;
    stored: () => readonly TaskEntity[];
    indexed: Record<string, unknown>[];
} {
    const repo = new InMemoryTaskRepository();
    repo.seed(...tasks);
    const indexed: Record<string, unknown>[] = [];
    const search = {
        partialUpdate: async (taskId: string, doc: Record<string, unknown>) => {
            indexed.push({ taskId, ...doc });
        },
    } satisfies TaskSearchIndexPort;
    return {
        useCase: new RenameTaskUseCase(repo, search, new FixedClock(NOW)),
        stored: () => repo.all(),
        indexed,
    };
}

describe("RenameTaskUseCase", () => {
    it("들어온 순위가 저장된 순위 이상이면 제목을 바꾸고 색인도 갱신한다", async () => {
        const { useCase, stored, indexed } = makeUseCase([makeTask("t1", "자동 제목", "auto")]);

        const result = await useCase.execute("t1", "사용자 제목", "user");

        expect(result).toEqual({ taskId: "t1", title: "사용자 제목" });
        expect(stored().find((t) => t.id === "t1")?.title).toBe("사용자 제목");
        expect(indexed).toEqual([{ taskId: "t1", title: "사용자 제목" }]);
    });

    it("들어온 순위가 저장된 순위보다 낮으면 제목을 지키고 색인을 건드리지 않는다", async () => {
        const { useCase, stored, indexed } = makeUseCase([makeTask("t1", "사용자 제목", "user")]);

        const result = await useCase.execute("t1", "에이전트 제목", "agent");

        expect(result).toEqual({ taskId: "t1", title: "사용자 제목" });
        expect(stored().find((t) => t.id === "t1")?.title).toBe("사용자 제목");
        expect(indexed).toEqual([]);
    });

    it("없는 태스크면 찾을 수 없다고 알린다", async () => {
        const { useCase } = makeUseCase([]);

        await expect(useCase.execute("missing", "제목", "user")).rejects.toThrow(NotFoundException);
    });
});
