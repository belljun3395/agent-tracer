import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { ChatThreadEntity } from "./chat.thread.entity.js";
import { ChatThreadRepository } from "./chat.thread.repository.js";

function thread(id: string, userId: string, updatedAt: Date): ChatThreadEntity {
    const entity = ChatThreadEntity.create({ id, userId, title: `대화 ${id}`, now: updatedAt });
    entity.updatedAt = updatedAt;
    return entity;
}

describe("ChatThreadRepository", () => {
    it("생성한 스레드를 id로 조회할 수 있다", async () => {
        const store = createInMemoryRepository<ChatThreadEntity>();
        const repo = new ChatThreadRepository(asRepository(store));
        const created = thread("t1", "u1", new Date("2026-07-21T00:00:00.000Z"));

        await repo.create(created);

        expect(await repo.findById("t1")).toEqual(created);
        expect(await repo.findById("missing")).toBeNull();
    });

    it("사용자 목록 조회는 최신 순으로 정렬된다", async () => {
        const store = createInMemoryRepository<ChatThreadEntity>();
        store.seed(
            thread("t1", "u1", new Date("2026-07-21T00:00:00.000Z")),
            thread("t2", "u1", new Date("2026-07-21T02:00:00.000Z")),
            thread("t3", "u2", new Date("2026-07-21T03:00:00.000Z")),
        );
        const repo = new ChatThreadRepository(asRepository(store));

        const found = await repo.listByUser("u1");

        expect(found.map((t) => t.id)).toEqual(["t2", "t1"]);
    });

    it("limit을 주면 그 개수만큼만 돌려준다", async () => {
        const store = createInMemoryRepository<ChatThreadEntity>();
        store.seed(
            thread("t1", "u1", new Date("2026-07-21T00:00:00.000Z")),
            thread("t2", "u1", new Date("2026-07-21T02:00:00.000Z")),
        );
        const repo = new ChatThreadRepository(asRepository(store));

        const found = await repo.listByUser("u1", 1);

        expect(found.map((t) => t.id)).toEqual(["t2"]);
    });

    it("update는 바뀐 필드를 반영한다", async () => {
        const store = createInMemoryRepository<ChatThreadEntity>();
        const created = thread("t1", "u1", new Date("2026-07-21T00:00:00.000Z"));
        store.seed(created);
        const repo = new ChatThreadRepository(asRepository(store));

        created.rename("바뀐 제목", new Date("2026-07-21T01:00:00.000Z"));
        await repo.update(created);

        const found = await repo.findById("t1");
        expect(found?.title).toBe("바뀐 제목");
    });

    it("deleteById는 그 스레드만 지운다", async () => {
        const store = createInMemoryRepository<ChatThreadEntity>();
        store.seed(
            thread("t1", "u1", new Date("2026-07-21T00:00:00.000Z")),
            thread("t2", "u1", new Date("2026-07-21T01:00:00.000Z")),
        );
        const repo = new ChatThreadRepository(asRepository(store));

        await repo.deleteById("t1");

        expect(await repo.findById("t1")).toBeNull();
        expect(await repo.findById("t2")).not.toBeNull();
    });
});
