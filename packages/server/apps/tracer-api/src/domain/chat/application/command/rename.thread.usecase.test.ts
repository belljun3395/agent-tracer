import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { RenameThreadUseCase } from "./rename.thread.usecase.js";

const NOW = new Date("2026-01-02T00:00:00.000Z");

describe("RenameThreadUseCase", () => {
    it("소유한 스레드의 제목을 바꾼다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "New conversation", now: new Date("2026-01-01T00:00:00.000Z") }));
        const useCase = new RenameThreadUseCase(threads, new FixedClock(NOW));

        const { thread } = await useCase.execute({ userId: "u1", threadId: "th1", title: "새 제목" });

        expect(thread.title).toBe("새 제목");
        expect((await threads.findById("th1"))?.title).toBe("새 제목");
        expect((await threads.findById("th1"))?.updatedAt).toEqual(NOW);
    });

    it("남의 스레드는 바꾸지 못한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") }));
        const useCase = new RenameThreadUseCase(threads, new FixedClock(NOW));

        await expect(useCase.execute({ userId: "u2", threadId: "th1", title: "새 제목" })).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});
