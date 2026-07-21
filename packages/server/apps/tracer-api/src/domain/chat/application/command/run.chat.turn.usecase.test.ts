import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AI_AGENT_BACKEND, type AiAgentBackend } from "@monitor/kernel";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, ChatThreadEntity, ChatUserMemoryEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatUserMemoryRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FakeChatAgent, fakeChatRegistry } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.agent.js";
import {
    chatApiKeySetting,
    FakeChatSettingReader,
} from "~tracer-api/domain/chat/port/__fakes__/fake.chat.setting.reader.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import type { ChatAgentPort } from "~tracer-api/domain/chat/port/chat.agent.port.js";
import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_SUMMARY_SPEC } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { ChatMissingApiKeyError } from "~tracer-api/domain/chat/model/chat.errors.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";
import { RunChatTurnUseCase } from "./run.chat.turn.usecase.js";

const NOW = new Date("2026-01-02T00:00:00.000Z");

function seed(threads: InMemoryChatThreadRepository, messages: InMemoryChatMessageRepository): void {
    threads.seed(ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") }));
    messages.seed(
        ChatMessageEntity.create({ id: "m1", threadId: "th1", role: CHAT_MESSAGE_ROLE.user, content: "질문", now: new Date("2026-01-01T00:01:00.000Z") }),
    );
}

function buildProjection(threads: InMemoryChatThreadRepository): SummarizeThreadProjection {
    return new SummarizeThreadProjection(threads, new FakeChatSummarizer(), new FixedClock(NOW));
}

function buildUseCase(
    threads: InMemoryChatThreadRepository,
    messages: InMemoryChatMessageRepository,
    agent: FakeChatAgent,
    memories: InMemoryChatUserMemoryRepository = new InMemoryChatUserMemoryRepository(),
    options: {
        readonly defaultBackend?: AiAgentBackend;
        readonly settingReader?: FakeChatSettingReader;
        readonly python?: ChatAgentPort;
    } = {},
): RunChatTurnUseCase {
    return new RunChatTurnUseCase(
        threads,
        messages,
        memories,
        fakeChatRegistry(agent, options.python),
        options.defaultBackend ?? AI_AGENT_BACKEND.claudeSdk,
        options.settingReader ?? new FakeChatSettingReader(),
        new FixedClock(NOW),
        buildProjection(threads),
    );
}

function collectingSink(): { sink: ChatTurnSink; deltas: string[] } {
    const deltas: string[] = [];
    return {
        deltas,
        sink: {
            onAssistantDelta: (text) => deltas.push(text),
            onToolCall: () => {},
            onToolResult: () => {},
        },
    };
}

describe("RunChatTurnUseCase", () => {
    it("턴을 실행해 어시스턴트 응답을 적재하고 스레드에 백엔드를 새긴다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답", [{ id: "c1", name: "get_task", args: { taskId: "t1" } }]);
        const useCase = buildUseCase(threads, messages, agent);
        const { sink, deltas } = collectingSink();

        const { message } = await useCase.execute({ userId: "u1", threadId: "th1" }, sink);

        expect(message?.role).toBe("assistant");
        expect(message?.content).toBe("답");
        expect(message?.toolCalls?.[0]?.name).toBe("get_task");
        expect(deltas).toEqual(["답"]);
        expect(agent.lastInput?.messages).toHaveLength(1);
        expect((await threads.findById("th1"))?.backend).toBe("claude-sdk");
    });

    it("남의 스레드는 실행하지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const useCase = buildUseCase(threads, messages, new FakeChatAgent());

        await expect(useCase.execute({ userId: "u2", threadId: "th1" }, collectingSink().sink)).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it("스레드에 요약이 있으면 재생 창을 최근 메시지로 좁힌다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        const thread = ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") });
        thread.updateSummary("이전 대화 요약", new Date("2026-01-01T00:00:00.000Z"));
        threads.seed(thread);
        const total = CHAT_SUMMARY_SPEC.recentKeepCount + 5;
        for (let i = 0; i < total; i += 1) {
            messages.seed(
                ChatMessageEntity.create({
                    id: `m${i}`,
                    threadId: "th1",
                    role: CHAT_MESSAGE_ROLE.user,
                    content: `메시지 ${i}`,
                    now: new Date(NOW.getTime() - (total - i) * 1000),
                }),
            );
        }
        const agent = new FakeChatAgent("답");
        const useCase = buildUseCase(threads, messages, agent);

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.messages).toHaveLength(CHAT_SUMMARY_SPEC.recentKeepCount);
        expect(agent.lastInput?.summary).toBe("이전 대화 요약");
    });

    it("요약이 없으면 재생 창이 전체 기록이다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답");
        const useCase = buildUseCase(threads, messages, agent);

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.messages).toHaveLength(1);
    });

    it("기억해 둔 사실을 다음 턴의 입력에 주입한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const memories = new InMemoryChatUserMemoryRepository();
        memories.seed(ChatUserMemoryEntity.create({ id: "mem1", userId: "u1", key: "tone", content: "간결하게", now: NOW }));
        const agent = new FakeChatAgent("답");
        const useCase = buildUseCase(threads, messages, agent, memories);

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.facts).toEqual([{ key: "tone", content: "간결하게" }]);
    });

    it("기억이 없으면 facts를 넘기지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답");
        const useCase = buildUseCase(threads, messages, agent);

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.facts).toBeUndefined();
    });

    it("local 프로파일 기본값(claude-sdk)이 키가 필요 없으면 설정을 읽지 않고 apiKey도 넘기지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답", [], AI_AGENT_BACKEND.claudeSdk, false);
        const settingReader = new FakeChatSettingReader(chatApiKeySetting("sk-should-not-be-read"));
        const useCase = buildUseCase(threads, messages, agent, undefined, {
            defaultBackend: AI_AGENT_BACKEND.claudeSdk,
            settingReader,
        });

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(settingReader.calls).toBe(0);
        expect(agent.lastInput?.apiKey).toBeUndefined();
    });

    it("기본값이 python(키 필요)이고 키가 설정돼 있으면 읽어서 apiKey로 넘긴다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const python = new FakeChatAgent("파이썬 답", [], AI_AGENT_BACKEND.python, true);
        const settingReader = new FakeChatSettingReader(chatApiKeySetting("sk-configured"));
        const useCase = buildUseCase(threads, messages, new FakeChatAgent(), undefined, {
            defaultBackend: AI_AGENT_BACKEND.python,
            settingReader,
            python,
        });

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(settingReader.calls).toBe(1);
        expect(python.lastInput?.apiKey).toBe("sk-configured");
    });

    it("키가 필요한 백엔드에 설정된 키가 없으면 MissingApiKey로 실패한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const python = new FakeChatAgent("파이썬 답", [], AI_AGENT_BACKEND.python, true);
        const useCase = buildUseCase(threads, messages, new FakeChatAgent(), undefined, {
            defaultBackend: AI_AGENT_BACKEND.python,
            settingReader: new FakeChatSettingReader(null),
            python,
        });

        await expect(
            useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink),
        ).rejects.toBeInstanceOf(ChatMissingApiKeyError);
    });

    it("취소 등으로 텍스트가 비어 있으면 어시스턴트 행을 남기지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("");
        const useCase = buildUseCase(threads, messages, agent);

        const { message } = await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(message).toBeNull();
        expect(await messages.listByThread("th1")).toHaveLength(1); // 씨딩한 사용자 메시지만 남는다.
        expect((await threads.findById("th1"))?.backend).toBeNull();
    });

    it("텍스트가 있으면 어시스턴트 행을 남긴다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답");
        const useCase = buildUseCase(threads, messages, agent);

        const { message } = await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(message?.content).toBe("답");
        expect(await messages.listByThread("th1")).toHaveLength(2);
    });
});
