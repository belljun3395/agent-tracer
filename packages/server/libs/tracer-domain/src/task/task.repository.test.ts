import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { TaskEntity } from "./task.entity.js";
import { TaskRepository } from "./task.repository.js";

function makeTask(id: string, updatedAt: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = "u1";
    task.title = id;
    task.slug = id;
    task.status = "running";
    task.taskKind = "primary";
    task.origin = "user";
    task.workspacePath = null;
    task.cliSource = null;
    task.parentTaskId = null;
    task.parentSessionId = null;
    task.backgroundOfTaskId = null;
    task.createdAt = new Date(updatedAt);
    task.updatedAt = new Date(updatedAt);
    task.lastSessionStartedAt = null;
    task.lastEventAt = null;
    return task;
}

describe("TaskRepository.findPage 커서", () => {
    it("같은 updated_at에 몰린 행도 (updated_at, id) 튜플로 하나도 건너뛰지 않고 페이지를 넘긴다", async () => {
        // 리퍼가 4개 태스크를 같은 시각으로 업데이트한 상황을 재현한다.
        const sameTimestamp = "2026-01-01T00:00:00.000Z";
        const repo = createInMemoryRepository<TaskEntity>();
        repo.seed(makeTask("t1", sameTimestamp), makeTask("t2", sameTimestamp), makeTask("t3", sameTimestamp), makeTask("t4", sameTimestamp));
        const repository = new TaskRepository(asRepository(repo));

        const page1 = await repository.findPage("u1", { limit: 2 });
        expect(page1.map((task) => task.id)).toEqual(["t4", "t3"]);

        const last = page1.at(-1);
        if (last === undefined) throw new Error("page1이 비어 있으면 안 된다");
        const page2 = await repository.findPage("u1", {
            limit: 2,
            cursor: { updatedAt: last.updatedAt.toISOString(), id: last.id },
        });

        // updated_at 단일 컬럼 커서였다면 남은 두 행도 전부 같은 시각이라 여기서 다 걸러진다.
        expect(page2.map((task) => task.id)).toEqual(["t2", "t1"]);
    });

    it("updated_at이 다르면 시각 내림차순을 우선한다", async () => {
        const repo = createInMemoryRepository<TaskEntity>();
        repo.seed(makeTask("older", "2026-01-01T00:00:00.000Z"), makeTask("newer", "2026-01-02T00:00:00.000Z"));
        const repository = new TaskRepository(asRepository(repo));

        const page = await repository.findPage("u1", { limit: 10 });

        expect(page.map((task) => task.id)).toEqual(["newer", "older"]);
    });

    it("parentTaskId를 주면 SQL where절에서 직접 좁힌다", async () => {
        const repo = createInMemoryRepository<TaskEntity>();
        const childA = makeTask("child-a", "2026-01-01T00:00:00.000Z");
        childA.parentTaskId = "parent-1";
        const childB = makeTask("child-b", "2026-01-01T00:00:00.000Z");
        childB.parentTaskId = "parent-2";
        repo.seed(childA, childB);
        const repository = new TaskRepository(asRepository(repo));

        const page = await repository.findPage("u1", { limit: 10, parentTaskId: "parent-1" });

        expect(page.map((task) => task.id)).toEqual(["child-a"]);
    });
});
