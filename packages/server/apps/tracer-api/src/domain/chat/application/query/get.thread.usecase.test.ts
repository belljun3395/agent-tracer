import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { GetThreadUseCase } from "./get.thread.usecase.js";

function thread(id: string, userId: string): ChatThreadEntity {
    return ChatThreadEntity.create({ id, userId, title: "t", now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("GetThreadUseCase", () => {
    it("소유한 스레드를 준다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(thread("th1", "u1"));
        const useCase = new GetThreadUseCase(threads);

        const { thread: dto } = await useCase.execute("u1", "th1");

        expect(dto.id).toBe("th1");
    });

    it("남의 스레드는 찾지 못한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(thread("th1", "u1"));
        const useCase = new GetThreadUseCase(threads);

        await expect(useCase.execute("u2", "th1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
