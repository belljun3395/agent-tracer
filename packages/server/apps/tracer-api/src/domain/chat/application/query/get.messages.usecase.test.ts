import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { GetMessagesUseCase } from "./get.messages.usecase.js";

describe("GetMessagesUseCase", () => {
    it("소유한 스레드의 메시지를 순서대로 준다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") }));
        messages.seed(
            ChatMessageEntity.create({ id: "m1", threadId: "th1", role: CHAT_MESSAGE_ROLE.user, content: "q", now: new Date("2026-01-01T00:01:00.000Z") }),
            ChatMessageEntity.create({ id: "m2", threadId: "th1", role: CHAT_MESSAGE_ROLE.assistant, content: "a", now: new Date("2026-01-01T00:02:00.000Z") }),
        );
        const useCase = new GetMessagesUseCase(threads, messages);

        const { items } = await useCase.execute("u1", "th1");

        expect(items.map((message) => message.id)).toEqual(["m1", "m2"]);
    });

    it("남의 스레드 메시지는 주지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") }));
        const useCase = new GetMessagesUseCase(threads, new InMemoryChatMessageRepository());

        await expect(useCase.execute("u2", "th1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
