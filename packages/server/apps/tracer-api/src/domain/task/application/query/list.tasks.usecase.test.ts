import { describe, expect, it } from "vitest";
import { TaskEntity, TaskUserStateEntity, encodeTaskPageCursor } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
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

function stateFor(
    taskId: string,
    options: { readonly userId?: string; readonly customTitle?: string; readonly archived?: boolean; readonly hidden?: boolean } = {},
): TaskUserStateEntity {
    const state = TaskUserStateEntity.init(taskId, options.userId ?? "u1", new Date("2026-01-02T00:00:00.000Z"));
    state.customTitle = options.customTitle ?? null;
    state.archivedAt = options.archived === true ? new Date("2026-01-02T00:00:00.000Z") : null;
    state.hiddenAt = options.hidden === true ? new Date("2026-01-02T00:00:00.000Z") : null;
    return state;
}

function makeTasks(...page: TaskEntity[]): InMemoryTaskRepository {
    const repo = new InMemoryTaskRepository();
    repo.seed(...page);
    return repo;
}

describe("ListTasksUseCase", () => {
    it("숨긴 작업이 LIMIT 슬롯을 소비하지 않는다", async () => {
        const tasks = makeTasks(
            makeTask("visible-old", null, "2026-01-01T00:00:00.000Z"),
            makeTask("visible-new", null, "2026-01-02T00:00:00.000Z"),
            makeTask("hidden-newest", null, "2026-01-03T00:00:00.000Z"),
        );
        tasks.seedUserStates(stateFor("hidden-newest", { hidden: true }));
        const useCase = new ListTasksUseCase(tasks);

        const result = await useCase.execute({ userId: "u1", limit: 2 });

        expect(result.items.map((item) => item.id)).toEqual(["visible-new", "visible-old"]);
        expect(tasks.visiblePageQueryCount).toBe(1);
        expect(result.nextCursor).toBe(
            encodeTaskPageCursor({ updatedAt: "2026-01-01T00:00:00.000Z", id: "visible-old" }),
        );
    });

    it("parentTaskId를 주면 visible page SQL where절로 그 부모의 하위 작업만 좁힌다", async () => {
        const tasks = makeTasks(
            makeTask("child-a", "parent-1", "2026-01-01T00:00:00.000Z"),
            makeTask("child-b", "parent-2", "2026-01-01T00:00:00.000Z"),
        );
        const useCase = new ListTasksUseCase(tasks);

        const result = await useCase.execute({ userId: "u1", parentTaskId: "parent-1" });

        expect(tasks.lastPageFilter?.parentTaskId).toBe("parent-1");
        expect(result.items.map((item) => item.id)).toEqual(["child-a"]);
    });

    it("limit을 1~100으로 조인다", async () => {
        const tasks = makeTasks();
        const useCase = new ListTasksUseCase(tasks);

        await useCase.execute({ userId: "u1", limit: 500 });
        expect(tasks.lastPageFilter?.limit).toBe(100);

        await useCase.execute({ userId: "u1", limit: 0 });
        expect(tasks.lastPageFilter?.limit).toBe(30);

        await useCase.execute({ userId: "u1" });
        expect(tasks.lastPageFilter?.limit).toBe(30);
    });

    it("status, origin, archived, rootOnly 필터를 visible page query에 보존한다", async () => {
        const tasks = makeTasks();
        const useCase = new ListTasksUseCase(tasks);

        await useCase.execute({
            userId: "u1",
            status: "completed",
            origin: "server-sdk",
            archived: false,
            rootOnly: true,
        });

        expect(tasks.lastPageFilter).toMatchObject({
            status: "completed",
            origin: "server-sdk",
            archived: false,
            rootOnly: true,
        });
    });

    it("페이지가 limit만큼 꽉 찼을 때만 nextCursor를 준다", async () => {
        const full = makeTasks(
            makeTask("t1", null, "2026-01-01T00:00:00.000Z"),
            makeTask("t2", null, "2026-01-02T00:00:00.000Z"),
        );
        const useCaseFull = new ListTasksUseCase(full);
        const resultFull = await useCaseFull.execute({ userId: "u1", limit: 2 });
        expect(resultFull.nextCursor).toBe(encodeTaskPageCursor({ updatedAt: "2026-01-01T00:00:00.000Z", id: "t1" }));

        const partial = makeTasks(makeTask("t1", null, "2026-01-01T00:00:00.000Z"));
        const useCasePartial = new ListTasksUseCase(partial);
        const resultPartial = await useCasePartial.execute({ userId: "u1", limit: 2 });
        expect(resultPartial.nextCursor).toBeNull();
    });

    it("입력 cursor를 (updated_at, id) 튜플로 디코드해 visible page query에 넘긴다", async () => {
        const tasks = makeTasks();
        const useCase = new ListTasksUseCase(tasks);
        const cursor = encodeTaskPageCursor({ updatedAt: "2026-01-01T00:00:00.000Z", id: "t9" });

        await useCase.execute({ userId: "u1", cursor });

        expect(tasks.lastPageFilter?.cursor).toEqual({ updatedAt: "2026-01-01T00:00:00.000Z", id: "t9" });
    });

    it("custom title과 archived 상태를 한 페이지 조회 결과에서 직렬화한다", async () => {
        const tasks = makeTasks(
            makeTask("active", null, "2026-01-02T00:00:00.000Z"),
            makeTask("archived", null, "2026-01-01T00:00:00.000Z"),
        );
        tasks.seedUserStates(
            stateFor("active", { customTitle: "사용자 제목" }),
            stateFor("archived", { archived: true }),
        );
        const useCase = new ListTasksUseCase(tasks);

        const active = await useCase.execute({ userId: "u1", archived: false });
        const archived = await useCase.execute({ userId: "u1", archived: true });

        expect(active.items).toHaveLength(1);
        expect(active.items[0]).toMatchObject({ id: "active", title: "사용자 제목", archived: false });
        expect(archived.items).toHaveLength(1);
        expect(archived.items[0]).toMatchObject({ id: "archived", archived: true });
    });

    it("다른 사용자의 상태 행은 같은 task id여도 목록에 영향을 주지 않는다", async () => {
        const tasks = makeTasks(makeTask("shared-id", null, "2026-01-01T00:00:00.000Z"));
        tasks.seedUserStates(stateFor("shared-id", { userId: "u2", customTitle: "다른 사용자 제목", hidden: true }));
        const useCase = new ListTasksUseCase(tasks);

        const result = await useCase.execute({ userId: "u1" });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ id: "shared-id", title: "shared-id", archived: false });
    });
});
