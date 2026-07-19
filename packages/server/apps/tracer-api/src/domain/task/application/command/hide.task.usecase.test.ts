import { describe, expect, it } from "vitest";
import { TaskEntity } from "@monitor/tracer-domain";
import { InMemoryTaskRepository } from "~tracer-api/domain/task/port/__fakes__/in-memory.task.repository.js";
import type { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { HideTaskUseCase } from "./hide.task.usecase.js";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function task(id: string, parentTaskId: string | null, userId = "u1"): TaskEntity {
    const entity = new TaskEntity();
    entity.id = id;
    entity.userId = userId;
    entity.title = id;
    entity.slug = id;
    entity.workspacePath = null;
    entity.status = "completed";
    entity.taskKind = "primary";
    entity.origin = "user";
    entity.cliSource = null;
    entity.parentTaskId = parentTaskId;
    entity.parentSessionId = null;
    entity.backgroundOfTaskId = null;
    entity.createdAt = NOW;
    entity.updatedAt = NOW;
    entity.lastSessionStartedAt = null;
    entity.lastEventAt = null;
    entity.lastAppliedSeq = null;
    return entity;
}

function makeUseCase(...seed: readonly TaskEntity[]) {
    const tasks = new InMemoryTaskRepository();
    tasks.seed(...seed);
    const hidden: { userId: string; taskIds: readonly string[] }[] = [];
    const states = {
        hideAll: async (userId: string, taskIds: readonly string[]) => {
            hidden.push({ userId, taskIds });
        },
    } as unknown as TaskUserStateService;
    return { useCase: new HideTaskUseCase(tasks, states), hidden };
}

describe("HideTaskUseCase", () => {
    it("자식이 없으면 요청된 태스크만 숨긴다", async () => {
        const { useCase, hidden } = makeUseCase(task("t1", null));

        const result = await useCase.execute("u1", "t1");

        expect(hidden).toEqual([{ userId: "u1", taskIds: ["t1"] }]);
        expect(result).toEqual({ taskId: "t1", hidden: true, hiddenTaskIds: ["t1"] });
    });

    it("서브에이전트 자손을 깊이와 무관하게 함께 숨긴다", async () => {
        const { useCase, hidden } = makeUseCase(
            task("t1", null),
            task("sub1", "t1"),
            task("sub2", "t1"),
            task("subsub", "sub1"),
        );

        const result = await useCase.execute("u1", "t1");

        expect(hidden[0]?.taskIds).toEqual(["t1", "sub1", "sub2", "subsub"]);
        expect(result.hiddenTaskIds).toHaveLength(4);
    });

    it("남의 자식은 숨김에 끌어들이지 않는다", async () => {
        const { useCase, hidden } = makeUseCase(task("t1", null), task("mine", "t1"), task("theirs", "t1", "u2"));

        await useCase.execute("u1", "t1");

        expect(hidden[0]?.taskIds).toEqual(["t1", "mine"]);
    });

    it("자손이 뿌리를 되가리키는 순환에서도 뿌리를 한 번만 담고 끝난다", async () => {
        // 자식 sub의 부모가 t1이고 t1의 부모가 sub이면 순회가 뿌리로 되돌아온다.
        const { useCase, hidden } = makeUseCase(task("t1", "sub"), task("sub", "t1"));

        await useCase.execute("u1", "t1");

        expect(hidden[0]?.taskIds).toEqual(["t1", "sub"]);
    });
});
