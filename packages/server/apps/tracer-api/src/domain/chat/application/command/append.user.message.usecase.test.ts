import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { AppendUserMessageUseCase } from "./append.user.message.usecase.js";

function thread(id: string, userId: string): ChatThreadEntity {
    return ChatThreadEntity.create({ id, userId, title: "t", now: new Date("2026-01-01T00:00:00.000Z") });
}

describe("AppendUserMessageUseCase", () => {
    it("소유한 스레드에 사용자 메시지를 적재한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        threads.seed(thread("th1", "u1"));
        const useCase = new AppendUserMessageUseCase(threads, messages, new FixedClock(new Date("2026-01-02T00:00:00.000Z")));

        const { message } = await useCase.execute({ userId: "u1", threadId: "th1", content: "안녕" });

        expect(message.role).toBe("user");
        expect(message.content).toBe("안녕");
        expect(await messages.listByThread("th1")).toHaveLength(1);
    });

    it("남의 스레드에는 적재하지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(thread("th1", "u1"));
        const useCase = new AppendUserMessageUseCase(
            threads,
            new InMemoryChatMessageRepository(),
            new FixedClock(new Date("2026-01-02T00:00:00.000Z")),
        );

        await expect(useCase.execute({ userId: "u2", threadId: "th1", content: "안녕" })).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});
