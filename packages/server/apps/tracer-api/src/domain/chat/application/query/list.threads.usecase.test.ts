import { describe, expect, it } from "vitest";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { ListThreadsUseCase } from "./list.threads.usecase.js";

function thread(id: string, userId: string, updated: string): ChatThreadEntity {
    const entity = ChatThreadEntity.create({ id, userId, title: id, now: new Date("2026-01-01T00:00:00.000Z") });
    entity.rename(id, new Date(updated));
    return entity;
}

describe("ListThreadsUseCase", () => {
    it("이 사용자의 스레드를 최신순으로 준다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(
            thread("a", "u1", "2026-01-02T00:00:00.000Z"),
            thread("b", "u1", "2026-01-03T00:00:00.000Z"),
            thread("c", "u2", "2026-01-04T00:00:00.000Z"),
        );
        const useCase = new ListThreadsUseCase(threads);

        const { items } = await useCase.execute("u1");

        expect(items.map((thread) => thread.id)).toEqual(["b", "a"]);
    });
});
