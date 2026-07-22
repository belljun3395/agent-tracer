import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { CHAT_MESSAGE_ROLE, ChatExecutionEntity, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { PrepareChatExecutionUseCase } from "./prepare.chat.execution.usecase.js";

const NOW = new Date("2026-07-22T00:00:00.000Z");

describe("PrepareChatExecutionUseCase", () => {
    it("재시도해도 running 실행의 같은 재생 입력을 만든다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        threads.seed(ChatThreadEntity.create({ id: "thread-1", userId: "user-1", title: "대화", now: NOW }));
        const user = ChatMessageEntity.create({ id: "message-1", threadId: "thread-1", role: CHAT_MESSAGE_ROLE.user, content: "질문", now: NOW });
        messages.seed(user);
        const execution = ChatExecutionEntity.create({
            userId: "user-1", threadId: "thread-1", userMessageId: user.id, clientRequestId: "request-1",
            inputHash: "hash-1", requestedBackend: AI_AGENT_BACKEND.claudeSdk, model: null, language: null, now: NOW,
        });
        executions.seed(execution);
        const useCase = new PrepareChatExecutionUseCase(
            executions, threads, AI_AGENT_BACKEND.claudeSdk, new FixedClock(NOW), new ChatExecutionEvents(),
        );

        const first = await useCase.execute(execution.id);
        expect(await useCase.execute(execution.id)).toEqual(first);
        expect((await executions.findById(execution.id))?.status).toBe("running");
    });
});
