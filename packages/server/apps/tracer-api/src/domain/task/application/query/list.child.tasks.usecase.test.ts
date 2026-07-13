import { describe, expect, it } from "vitest";
import { TaskEntity, TaskUserStateEntity } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import { InMemoryTaskUserStateRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.user.state.repository.js";
import { ListChildTasksUseCase } from "./list.child.tasks.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function makeTask(id: string, userId: string, parentTaskId: string | null): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    task.title = `제목-${id}`;
    task.slug = id;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = "/repo";
    task.cliSource = null;
    task.parentTaskId = parentTaskId;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = NOW;
    task.updatedAt = NOW;
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

function hiddenState(taskId: string, userId: string): TaskUserStateEntity {
    const state = TaskUserStateEntity.init(taskId, userId, NOW);
    state.hide(NOW);
    return state;
}

function makeUseCase(
    tasks: readonly TaskEntity[],
    states: readonly TaskUserStateEntity[] = [],
): ListChildTasksUseCase {
    const taskRepo = new InMemoryTaskRepository();
    taskRepo.seed(...tasks);
    const stateRepo = new InMemoryTaskUserStateRepository();
    stateRepo.seed(...states);
    return new ListChildTasksUseCase(taskRepo, stateRepo);
}

describe("ListChildTasksUseCase", () => {
    it("부모의 자식 태스크를 목록으로 낸다", async () => {
        const useCase = makeUseCase([
            makeTask("parent", "u1", null),
            makeTask("child-1", "u1", "parent"),
            makeTask("child-2", "u1", "parent"),
            makeTask("other", "u1", null),
        ]);

        const result = await useCase.execute("u1", "parent");

        expect(result?.items.map((item) => item.id)).toEqual(["child-1", "child-2"]);
    });

    it("숨긴 자식은 목록에서 뺀다", async () => {
        const useCase = makeUseCase(
            [makeTask("parent", "u1", null), makeTask("child-1", "u1", "parent"), makeTask("child-2", "u1", "parent")],
            [hiddenState("child-1", "u1")],
        );

        const result = await useCase.execute("u1", "parent");

        expect(result?.items.map((item) => item.id)).toEqual(["child-2"]);
    });

    it("남의 태스크는 존재 여부도 드러내지 않는다", async () => {
        const useCase = makeUseCase([makeTask("parent", "u2", null), makeTask("child-1", "u2", "parent")]);

        const result = await useCase.execute("u1", "parent");

        expect(result).toBeNull();
    });

    it("없는 태스크면 null을 낸다", async () => {
        const useCase = makeUseCase([]);

        const result = await useCase.execute("u1", "missing");

        expect(result).toBeNull();
    });
});
