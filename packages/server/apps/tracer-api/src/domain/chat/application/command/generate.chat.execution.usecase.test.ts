import { describe, expect, it } from "vitest";
import { AI_AGENT_BACKEND } from "@monitor/kernel";
import { FakeChatAgent, fakeChatRegistry } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.agent.js";
import { FakeChatSettingReader } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.setting.reader.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import type { ChatExecutionSinkFactoryPort } from "~tracer-api/domain/chat/port/chat.execution.sink.port.js";
import { GenerateChatExecutionUseCase } from "./generate.chat.execution.usecase.js";

describe("GenerateChatExecutionUseCase", () => {
    it("확정된 입력으로 모델을 한 번 호출하고 결과를 다음 단계에 넘긴다", async () => {
        const sdk = new FakeChatAgent("", [], AI_AGENT_BACKEND.claudeSdk);
        const graph = new FakeChatAgent("답변", [], AI_AGENT_BACKEND.python);
        const sinks: ChatExecutionSinkFactoryPort = { create: () => ({
            sink: { onAssistantDelta: () => undefined, onToolCall: () => undefined, onToolResult: () => undefined },
            flush: async () => undefined, close: () => undefined,
        }) };
        const useCase = new GenerateChatExecutionUseCase(
            fakeChatRegistry(sdk, graph),
            new FakeChatSettingReader(null), sinks, new InMemoryChatExecutionRepository(),
            new InMemoryChatThreadRepository(), new InMemoryChatMessageRepository(),
            new InMemoryChatUserMemoryRepository(),
        );

        const generated = await useCase.execute({
            executionId: "execution-1", threadId: "thread-1", userId: "user-1",
            backend: AI_AGENT_BACKEND.python, language: "auto",
        }, new AbortController().signal);

        expect(generated.result.text).toBe("답변");
        expect(graph.calls).toBe(1);
        expect(graph.lastInput?.messages).toEqual([]);
        expect(graph.lastInput?.idempotencyKey).toBe("execution-1");
    });
});
