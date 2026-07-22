import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { CHAT_MESSAGE_ROLE, ChatExecutionEntity, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { inMemoryChatTransaction } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";
import { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";
import { FinalizeChatExecutionUseCase } from "./finalize.chat.execution.usecase.js";

const NOW = new Date("2026-07-22T00:00:00.000Z");

describe("FinalizeChatExecutionUseCase", () => {
    it("재시도해도 완료 메시지를 중복 적재하지 않는다", async () => {
        const executions = new InMemoryChatExecutionRepository();
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        const pendingTools = new InMemoryChatPendingToolRepository();
        const thread = ChatThreadEntity.create({ id: "thread-1", userId: "user-1", title: "대화", now: NOW });
        threads.seed(thread);
        const user = ChatMessageEntity.create({ id: "message-1", threadId: thread.id, role: CHAT_MESSAGE_ROLE.user, content: "질문", now: NOW });
        messages.seed(user);
        const execution = ChatExecutionEntity.create({
            userId: "user-1", threadId: thread.id, userMessageId: user.id, clientRequestId: "request-1",
            inputHash: "hash-1", requestedBackend: AI_AGENT_BACKEND.claudeSdk, model: null, language: null, now: NOW,
        });
        execution.start(NOW);
        executions.seed(execution);
        const clock = new FixedClock(NOW);
        const summarizer = new FakeChatSummarizer();
        const useCase = new FinalizeChatExecutionUseCase(
            executions, threads, messages, inMemoryChatTransaction({ executions, threads, messages, pendingTools }),
            clock, new ChatExecutionEvents(), new SummarizeThreadProjection(threads, summarizer, clock),
            new GenerateThreadTitleProjection(threads, summarizer, clock),
        );
        const generated = { executionId: execution.id, result: {
            text: "답변", backend: AI_AGENT_BACKEND.claudeSdk, toolCalls: [], modelUsed: "model",
            costUsd: null, numTurns: null, usage: null, errorSummary: null,
        } } as const;

        await useCase.execute(generated);
        await useCase.execute(generated);

        expect((await executions.findById(execution.id))?.status).toBe("completed");
        expect((await messages.listByThread(thread.id)).filter(({ role }) => role === CHAT_MESSAGE_ROLE.assistant)).toHaveLength(1);
    });
});
