import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { InMemoryChatMessageRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { FakeChatAgent, fakeChatRegistry } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.agent.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import { CHAT_SUMMARY_SPEC } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
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
        const useCase = new RunChatTurnUseCase(
            threads,
            messages,
            fakeChatRegistry(agent),
            new FixedClock(NOW),
            buildProjection(threads),
        );
        const { sink, deltas } = collectingSink();

        const { message } = await useCase.execute({ userId: "u1", threadId: "th1" }, sink);

        expect(message.role).toBe("assistant");
        expect(message.content).toBe("답");
        expect(message.toolCalls?.[0]?.name).toBe("get_task");
        expect(deltas).toEqual(["답"]);
        expect(agent.lastInput?.messages).toHaveLength(1);
        expect((await threads.findById("th1"))?.backend).toBe("claude-sdk");
    });

    it("남의 스레드는 실행하지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const useCase = new RunChatTurnUseCase(
            threads,
            messages,
            fakeChatRegistry(new FakeChatAgent()),
            new FixedClock(NOW),
            buildProjection(threads),
        );

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
        const useCase = new RunChatTurnUseCase(
            threads,
            messages,
            fakeChatRegistry(agent),
            new FixedClock(NOW),
            buildProjection(threads),
        );

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.messages).toHaveLength(CHAT_SUMMARY_SPEC.recentKeepCount);
        expect(agent.lastInput?.summary).toBe("이전 대화 요약");
    });

    it("요약이 없으면 재생 창이 전체 기록이다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const messages = new InMemoryChatMessageRepository();
        seed(threads, messages);
        const agent = new FakeChatAgent("답");
        const useCase = new RunChatTurnUseCase(
            threads,
            messages,
            fakeChatRegistry(agent),
            new FixedClock(NOW),
            buildProjection(threads),
        );

        await useCase.execute({ userId: "u1", threadId: "th1" }, collectingSink().sink);

        expect(agent.lastInput?.messages).toHaveLength(1);
    });
});
