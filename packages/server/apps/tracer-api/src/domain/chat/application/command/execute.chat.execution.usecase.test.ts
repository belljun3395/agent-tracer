import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { CHAT_MESSAGE_ROLE, ChatExecutionEntity, ChatMessageEntity, ChatThreadEntity, ChatUserMemoryEntity } from "@monitor/tracer-domain";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { inMemoryChatTransaction } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FakeChatAgent, fakeChatRegistry } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.agent.js";
import { chatApiKeySetting, FakeChatSettingReader } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.setting.reader.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import type { ChatExecutionSinkFactoryPort } from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";
import { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";
import { ExecuteChatExecutionUseCase } from "./execute.chat.execution.usecase.js";

const NOW = new Date("2026-07-22T00:00:00.000Z");

function build(options: {
    readonly text?: string;
    readonly backend?: typeof AI_AGENT_BACKEND.claudeSdk | typeof AI_AGENT_BACKEND.python;
    readonly needsApiKey?: boolean;
    readonly apiKey?: string;
    readonly summary?: string;
    readonly withMemory?: boolean;
} = {}) {
    const threads = new InMemoryChatThreadRepository();
    const messages = new InMemoryChatMessageRepository();
    const pendingTools = new InMemoryChatPendingToolRepository();
    const executions = new InMemoryChatExecutionRepository();
    const sdk = new FakeChatAgent(options.text ?? "답변", [], AI_AGENT_BACKEND.claudeSdk, options.needsApiKey ?? false);
    const python = new FakeChatAgent(options.text ?? "답변", [], AI_AGENT_BACKEND.python, options.needsApiKey ?? false);
    const clock = new FixedClock(NOW);
    const thread = ChatThreadEntity.create({ id: "thread-1", userId: "user-1", title: "대화", now: NOW });
    if (options.summary !== undefined) thread.updateSummary(options.summary, NOW);
    threads.seed(thread);
    const user = ChatMessageEntity.create({
        id: "message-1",
        threadId: "thread-1",
        role: CHAT_MESSAGE_ROLE.user,
        content: "질문",
        now: NOW,
    });
    messages.seed(user);
    const execution = ChatExecutionEntity.create({
        userId: "user-1",
        threadId: "thread-1",
        userMessageId: user.id,
        clientRequestId: "request-1",
        inputHash: "hash-1",
        requestedBackend: options.backend ?? AI_AGENT_BACKEND.claudeSdk,
        model: null,
        language: null,
        now: NOW,
    });
    executions.seed(execution);
    const sinks: ChatExecutionSinkFactoryPort = {
        create: () => ({
            sink: {
                onAssistantDelta: () => undefined,
                onToolCall: () => undefined,
                onToolResult: () => undefined,
            },
            flush: async () => undefined,
            close: () => undefined,
        }),
    };
    const memories = new InMemoryChatUserMemoryRepository();
    if (options.withMemory) {
        memories.seed(ChatUserMemoryEntity.create({ id: "memory-1", userId: "user-1", key: "tone", content: "간결하게", now: NOW }));
    }
    const settings = new FakeChatSettingReader(options.apiKey === undefined ? null : chatApiKeySetting(options.apiKey));
    const useCase = new ExecuteChatExecutionUseCase(
        executions,
        threads,
        messages,
        memories,
        fakeChatRegistry(sdk, python),
        AI_AGENT_BACKEND.claudeSdk,
        settings,
        clock,
        inMemoryChatTransaction({ threads, messages, pendingTools, executions }),
        sinks,
        new ChatExecutionEvents(),
        new SummarizeThreadProjection(threads, new FakeChatSummarizer(), clock),
        new GenerateThreadTitleProjection(threads, new FakeChatSummarizer(), clock),
    );
    return { useCase, execution, executions, messages, sdk, python, threads, settings };
}

describe("ExecuteChatExecutionUseCase", () => {
    it("대기 실행을 한 번 점유하고 어시스턴트 적재와 완료를 함께 남긴다", async () => {
        const { useCase, execution, executions, messages } = build();

        await useCase.execute(execution.id, new AbortController().signal);

        const stored = await executions.findById(execution.id);
        expect(stored?.status).toBe("completed");
        expect(stored?.assistantMessageId).toBe(execution.id);
        expect((await messages.findById(execution.id))?.content).toBe("답변");
    });

    it("같은 실행을 동시에 요청해도 조건부 점유로 모델을 한 번만 부른다", async () => {
        const { useCase, execution, sdk } = build();

        await Promise.all([
            useCase.execute(execution.id, new AbortController().signal),
            useCase.execute(execution.id, new AbortController().signal),
        ]);

        expect(sdk.calls).toBe(1);
    });

    it("빈 응답은 어시스턴트 행 없이 실패 상태로 끝낸다", async () => {
        const { useCase, execution, executions, messages } = build({ text: "" });

        await useCase.execute(execution.id, new AbortController().signal);

        expect((await executions.findById(execution.id))?.status).toBe("failed");
        expect(await messages.findById(execution.id)).toBeNull();
    });

    it("SDK 답변 뒤 python으로 바꿔도 저장된 대화 이력을 그대로 재생한다", async () => {
        const { useCase, execution, executions, messages, python } = build({ backend: AI_AGENT_BACKEND.python });
        const previousUser = ChatMessageEntity.create({
            id: "user-before",
            threadId: "thread-1",
            role: CHAT_MESSAGE_ROLE.user,
            content: "이전 질문",
            now: new Date(NOW.getTime() - 3),
        });
        messages.seed(previousUser);
        messages.seed(
            ChatMessageEntity.create({
                id: "assistant-before",
                threadId: "thread-1",
                role: CHAT_MESSAGE_ROLE.assistant,
                content: "SDK 답변",
                now: new Date(NOW.getTime() - 2),
            }),
        );
        const previous = ChatExecutionEntity.create({
            userId: "user-1",
            threadId: "thread-1",
            userMessageId: previousUser.id,
            clientRequestId: "request-before",
            inputHash: "hash-before",
            requestedBackend: AI_AGENT_BACKEND.claudeSdk,
            model: null,
            language: null,
            now: new Date(NOW.getTime() - 3),
        });
        previous.start(new Date(NOW.getTime() - 2));
        previous.complete("assistant-before", new Date(NOW.getTime() - 1));
        executions.seed(previous);

        await useCase.execute(execution.id, new AbortController().signal);

        expect(python.lastInput?.messages.map(({ role, content }) => ({ role, content }))).toEqual([
            { role: "user", content: "이전 질문" },
            { role: "assistant", content: "SDK 답변" },
            { role: "user", content: "질문" },
        ]);
    });

    it("요약과 기억은 전달하고 현재 실행 뒤의 대기 메시지는 재생하지 않는다", async () => {
        const { useCase, execution, executions, messages, sdk } = build({ summary: "이전 요약", withMemory: true });
        const future = ChatMessageEntity.create({ id: "message-future", threadId: "thread-1", role: CHAT_MESSAGE_ROLE.user, content: "미래 질문", now: new Date(NOW.getTime() + 1) });
        messages.seed(future);
        executions.seed(ChatExecutionEntity.create({ userId: "user-1", threadId: "thread-1", userMessageId: future.id, clientRequestId: "request-future", inputHash: "hash-future", requestedBackend: null, model: null, language: null, now: future.createdAt }));

        await useCase.execute(execution.id, new AbortController().signal);

        expect(sdk.lastInput?.summary).toBe("이전 요약");
        expect(sdk.lastInput?.facts).toEqual([{ key: "tone", content: "간결하게" }]);
        expect(sdk.lastInput?.messages.some((row) => row.content === "미래 질문")).toBe(false);
        expect(sdk.lastInput?.idempotencyKey).toBe(execution.id);
    });

    it("키가 필요 없는 백엔드는 설정을 읽지 않는다", async () => {
        const { useCase, execution, sdk, settings } = build();
        await useCase.execute(execution.id, new AbortController().signal);
        expect(settings.calls).toBe(0);
        expect(sdk.lastInput?.apiKey).toBeUndefined();
    });

    it("키가 필요한 백엔드에는 저장된 키를 전달한다", async () => {
        const { useCase, execution, python, settings } = build({ backend: AI_AGENT_BACKEND.python, needsApiKey: true, apiKey: "sk-test" });
        await useCase.execute(execution.id, new AbortController().signal);
        expect(settings.calls).toBe(1);
        expect(python.lastInput?.apiKey).toBe("sk-test");
    });

    it("키가 필요한 백엔드에 키가 없으면 모델을 호출하지 않고 실패시킨다", async () => {
        const { useCase, execution, executions, python, messages } = build({ backend: AI_AGENT_BACKEND.python, needsApiKey: true });
        await expect(useCase.execute(execution.id, new AbortController().signal)).rejects.toThrow("API key");
        expect(python.calls).toBe(0);
        expect((await executions.findById(execution.id))?.status).toBe("failed");
        expect(await messages.findById(execution.id)).toBeNull();
    });
});
