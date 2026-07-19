import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { TaskTagEntity } from "./task-tag.entity.js";
import { TaskTagRepository } from "./task-tag.repository.js";

function taskTag(id: string, userId: string, taskId: string, tagId: string): TaskTagEntity {
    return TaskTagEntity.create({ id, userId, taskId, tagId, now: new Date("2026-07-16T00:00:00.000Z") });
}

describe("TaskTagRepository", () => {
    it("findByTask는 그 태스크에 붙은 태그 부착 행만 준다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-1", "tag-b"), taskTag("tt3", "u1", "task-2", "tag-a"));
        const repo = new TaskTagRepository(asRepository(store));

        const found = await repo.findByTask("u1", "task-1");

        expect(found.map((row) => row.tagId).sort()).toEqual(["tag-a", "tag-b"]);
    });

    it("findByTag는 그 태그가 붙은 태스크들의 부착 행만 준다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-2", "tag-a"), taskTag("tt3", "u1", "task-1", "tag-b"));
        const repo = new TaskTagRepository(asRepository(store));

        const found = await repo.findByTag("u1", "tag-a");

        expect(found.map((row) => row.taskId).sort()).toEqual(["task-1", "task-2"]);
    });

    it("findByTasks는 여러 태스크의 부착 행을 한 번에 모으고 빈 배열이면 조회하지 않는다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-2", "tag-b"), taskTag("tt3", "u1", "task-3", "tag-c"));
        const repo = new TaskTagRepository(asRepository(store));

        const found = await repo.findByTasks("u1", ["task-1", "task-2"]);
        expect(found.map((row) => row.id).sort()).toEqual(["tt1", "tt2"]);

        expect(await repo.findByTasks("u1", [])).toEqual([]);
    });

    it("countByTag는 사용자 안에서 tagId별 부착 개수를 센다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(
            taskTag("tt1", "u1", "task-1", "tag-a"),
            taskTag("tt2", "u1", "task-2", "tag-a"),
            taskTag("tt3", "u1", "task-1", "tag-b"),
            taskTag("tt4", "u2", "task-9", "tag-a"),
        );
        const repo = new TaskTagRepository(asRepository(store));

        const counts = await repo.countByTag("u1");

        expect(counts).toEqual({ "tag-a": 2, "tag-b": 1 });
    });

    it("insertMany는 빈 배열이면 아무것도 넣지 않는다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        const repo = new TaskTagRepository(asRepository(store));

        await repo.insertMany([]);

        expect(store.all()).toEqual([]);
    });

    it("insertMany로 넣은 행이 findByTask에서 그대로 조회된다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        const repo = new TaskTagRepository(asRepository(store));

        await repo.insertMany([taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-1", "tag-b")]);

        const found = await repo.findByTask("u1", "task-1");
        expect(found.map((row) => row.tagId).sort()).toEqual(["tag-a", "tag-b"]);
    });

    it("deleteByTaskAndTags는 지정한 태그만 그 태스크에서 떼어낸다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-1", "tag-b"), taskTag("tt3", "u1", "task-1", "tag-c"));
        const repo = new TaskTagRepository(asRepository(store));

        await repo.deleteByTaskAndTags("u1", "task-1", ["tag-a", "tag-c"]);

        const found = await repo.findByTask("u1", "task-1");
        expect(found.map((row) => row.tagId)).toEqual(["tag-b"]);
    });

    it("deleteByTag는 그 태그의 부착 행을 모두 지운다", async () => {
        const store = createInMemoryRepository<TaskTagEntity>();
        store.seed(taskTag("tt1", "u1", "task-1", "tag-a"), taskTag("tt2", "u1", "task-2", "tag-a"), taskTag("tt3", "u1", "task-1", "tag-b"));
        const repo = new TaskTagRepository(asRepository(store));

        await repo.deleteByTag("u1", "tag-a");

        expect(store.all().map((row) => row.tagId)).toEqual(["tag-b"]);
    });
});
