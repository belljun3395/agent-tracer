import { describe, expect, it } from "vitest";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { CreateThreadUseCase } from "./create.thread.usecase.js";

describe("CreateThreadUseCase", () => {
    it("새 스레드를 사용자 소유로 열고 백엔드는 아직 비운다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
        const useCase = new CreateThreadUseCase(threads, clock);

        const { thread } = await useCase.execute({ userId: "u1", title: "첫 대화" });

        expect(thread.userId).toBe("u1");
        expect(thread.title).toBe("첫 대화");
        expect(thread.backend).toBeNull();
        expect(await threads.findById(thread.id)).not.toBeNull();
    });
});
