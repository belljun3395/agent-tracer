import { describe, expect, it } from "vitest";
import { ChatUserMemoryEntity } from "@monitor/tracer-domain";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { ListUserMemoriesUseCase } from "./list.user.memories.usecase.js";

function memory(userId: string, key: string, content: string, updated: string): ChatUserMemoryEntity {
    const entity = ChatUserMemoryEntity.create({
        id: `${userId}-${key}`,
        userId,
        key,
        content,
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
    entity.updateContent(content, new Date(updated));
    return entity;
}

describe("ListUserMemoriesUseCase", () => {
    it("이 사용자의 장기기억을 최신순으로 준다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        memories.seed(
            memory("u1", "lang", "한국어", "2026-01-02T00:00:00.000Z"),
            memory("u1", "editor", "vim", "2026-01-03T00:00:00.000Z"),
            memory("u2", "lang", "english", "2026-01-04T00:00:00.000Z"),
        );
        const useCase = new ListUserMemoriesUseCase(memories);

        const { items } = await useCase.execute("u1");

        expect(items.map((item) => item.key)).toEqual(["editor", "lang"]);
        expect(items[0]).toEqual({ key: "editor", content: "vim", updatedAt: "2026-01-03T00:00:00.000Z" });
    });
});
