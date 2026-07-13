import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { TaskEntity } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { SetTaskStatusUseCase } from "./set.task.status.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeTask(id: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = "u1";
    task.title = "제목";
    task.slug = "title";
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = "/repo";
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

function makeUseCase(tasks: readonly TaskEntity[]): { useCase: SetTaskStatusUseCase; stored: () => readonly TaskEntity[] } {
    const repo = new InMemoryTaskRepository();
    repo.seed(...tasks);
    return {
        useCase: new SetTaskStatusUseCase(repo),
        stored: () => repo.all(),
    };
}

describe("SetTaskStatusUseCase", () => {
    it("태스크 상태를 강제로 바꿔 저장한다", async () => {
        const { useCase, stored } = makeUseCase([makeTask("t1")]);

        const result = await useCase.execute("t1", "completed");

        expect(result).toEqual({ taskId: "t1", status: "completed" });
        expect(stored().find((t) => t.id === "t1")?.status).toBe("completed");
    });

    it("없는 태스크면 찾을 수 없다고 알린다", async () => {
        const { useCase } = makeUseCase([]);

        await expect(useCase.execute("missing", "completed")).rejects.toThrow(NotFoundException);
    });
});
