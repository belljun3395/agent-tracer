import { describe, expect, it } from "vitest";
import { TaskEntity, TaskUserStateEntity, encodeTaskPageCursor } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { InMemoryTaskUserStateRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.user.state.repository.js";
import { ListTasksUseCase } from "./list.tasks.usecase.js";

function makeTask(id: string, parentTaskId: string | null, updatedAt: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = "u1";
    task.title = id;
    task.slug = id;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = "/repo";
    task.cliSource = null;
    task.parentTaskId = parentTaskId;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = new Date(updatedAt);
    task.updatedAt = new Date(updatedAt);
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

function hiddenState(taskId: string): TaskUserStateEntity {
    const state = new TaskUserStateEntity();
    state.taskId = taskId;
    state.userId = "u1";
    state.customTitle = null;
    state.archivedAt = null;
    state.hiddenAt = new Date("2026-01-02T00:00:00.000Z");
    state.updatedAt = new Date("2026-01-02T00:00:00.000Z");
    return state;
}

function makeTasks(...page: TaskEntity[]): InMemoryTaskRepository {
    const repo = new InMemoryTaskRepository();
    repo.seed(...page);
    return repo;
}

function makeStates(...hidden: string[]): InMemoryTaskUserStateRepository {
    const repo = new InMemoryTaskUserStateRepository();
    repo.seed(...hidden.map(hiddenState));
    return repo;
}

describe("ListTasksUseCase", () => {
    it("숨긴 작업을 목록에서 제외한다", async () => {
        const tasks = makeTasks(
            makeTask("t1", null, "2026-01-01T00:00:00.000Z"),
            makeTask("t2", null, "2026-01-01T00:00:00.000Z"),
        );
        const useCase = new ListTasksUseCase(tasks, makeStates("t2"));

        const result = await useCase.execute({ userId: "u1" });

        expect(result.items.map((item) => item.id)).toEqual(["t1"]);
    });

    it("parentTaskId를 주면 findPage의 SQL where절로 그 부모의 하위 작업만 좁힌다", async () => {
        const tasks = makeTasks(
            makeTask("child-a", "parent-1", "2026-01-01T00:00:00.000Z"),
            makeTask("child-b", "parent-2", "2026-01-01T00:00:00.000Z"),
        );
        const useCase = new ListTasksUseCase(tasks, makeStates());

        const result = await useCase.execute({ userId: "u1", parentTaskId: "parent-1" });

        expect(tasks.lastPageFilter?.parentTaskId).toBe("parent-1");
        expect(result.items.map((item) => item.id)).toEqual(["child-a"]);
    });

    it("limit을 1~100으로 조인다", async () => {
        const tasks = makeTasks();
        const useCase = new ListTasksUseCase(tasks, makeStates());

        await useCase.execute({ userId: "u1", limit: 500 });
        expect(tasks.lastPageFilter?.limit).toBe(100);

        await useCase.execute({ userId: "u1", limit: 0 });
        expect(tasks.lastPageFilter?.limit).toBe(30);

        await useCase.execute({ userId: "u1" });
        expect(tasks.lastPageFilter?.limit).toBe(30);
    });

    it("페이지가 limit만큼 꽉 찼을 때만 nextCursor를 준다", async () => {
        const full = makeTasks(
            makeTask("t1", null, "2026-01-01T00:00:00.000Z"),
            makeTask("t2", null, "2026-01-02T00:00:00.000Z"),
        );
        const useCaseFull = new ListTasksUseCase(full, makeStates());
        const resultFull = await useCaseFull.execute({ userId: "u1", limit: 2 });
        expect(resultFull.nextCursor).toBe(encodeTaskPageCursor({ updatedAt: "2026-01-02T00:00:00.000Z", id: "t2" }));

        const partial = makeTasks(makeTask("t1", null, "2026-01-01T00:00:00.000Z"));
        const useCasePartial = new ListTasksUseCase(partial, makeStates());
        const resultPartial = await useCasePartial.execute({ userId: "u1", limit: 2 });
        expect(resultPartial.nextCursor).toBeNull();
    });

    it("입력 cursor를 (updated_at, id) 튜플로 디코드해 findPage에 넘긴다", async () => {
        const tasks = makeTasks();
        const useCase = new ListTasksUseCase(tasks, makeStates());
        const cursor = encodeTaskPageCursor({ updatedAt: "2026-01-01T00:00:00.000Z", id: "t9" });

        await useCase.execute({ userId: "u1", cursor });

        expect(tasks.lastPageFilter?.cursor).toEqual({ updatedAt: "2026-01-01T00:00:00.000Z", id: "t9" });
    });
});
