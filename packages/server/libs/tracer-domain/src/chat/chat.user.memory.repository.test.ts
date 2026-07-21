import { describe, expect, it } from "vitest";
import { asRepository, createInMemoryRepository } from "../__fixtures__/in-memory-repository.js";
import { ChatUserMemoryEntity } from "./chat.user.memory.entity.js";
import { ChatUserMemoryRepository } from "./chat.user.memory.repository.js";

function memory(id: string, userId: string, key: string, now: Date): ChatUserMemoryEntity {
    return ChatUserMemoryEntity.create({ id, userId, key, content: `기억 ${id}`, now });
}

describe("ChatUserMemoryRepository", () => {
    it("upsert는 같은 (userId, key)를 가진 행을 덮어쓴다", async () => {
        const store = createInMemoryRepository<ChatUserMemoryEntity>();
        const repo = new ChatUserMemoryRepository(asRepository(store));
        const first = memory("mem1", "u1", "preferred-language", new Date("2026-07-21T00:00:00.000Z"));

        await repo.upsert(first);
        first.updateContent("바뀐 기억", new Date("2026-07-21T01:00:00.000Z"));
        await repo.upsert(first);

        const found = await repo.findByKey("u1", "preferred-language");
        expect(found?.content).toBe("바뀐 기억");
        expect(store.all()).toHaveLength(1);
    });

    it("사용자별 목록은 그 사용자의 기억만 준다", async () => {
        const store = createInMemoryRepository<ChatUserMemoryEntity>();
        store.seed(
            memory("mem1", "u1", "key-a", new Date("2026-07-21T00:00:00.000Z")),
            memory("mem2", "u1", "key-b", new Date("2026-07-21T01:00:00.000Z")),
            memory("mem3", "u2", "key-a", new Date("2026-07-21T00:00:00.000Z")),
        );
        const repo = new ChatUserMemoryRepository(asRepository(store));

        const found = await repo.listByUser("u1");

        expect(found.map((m) => m.id).sort()).toEqual(["mem1", "mem2"]);
    });

    it("findByKey는 없는 키에 null을 준다", async () => {
        const store = createInMemoryRepository<ChatUserMemoryEntity>();
        const repo = new ChatUserMemoryRepository(asRepository(store));
        expect(await repo.findByKey("u1", "missing")).toBeNull();
    });
});
