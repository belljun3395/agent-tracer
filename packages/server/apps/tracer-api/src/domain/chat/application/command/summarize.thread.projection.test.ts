import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { CHAT_SUMMARY_SPEC } from "~tracer-api/domain/chat/model/chat.summary.spec.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";

const NOW = new Date("2026-01-03T00:00:00.000Z");

function seedThread(threads: InMemoryChatThreadRepository, summary: string | null = null): ChatThreadEntity {
    const thread = ChatThreadEntity.create({ id: "th1", userId: "u1", title: "t", now: new Date("2026-01-01T00:00:00.000Z") });
    if (summary !== null) thread.updateSummary(summary, new Date("2026-01-01T00:00:00.000Z"));
    threads.seed(thread);
    return thread;
}

function messagesOf(count: number): ChatMessageEntity[] {
    return Array.from({ length: count }, (_, i) =>
        ChatMessageEntity.create({
            id: `m${i}`,
            threadId: "th1",
            role: i % 2 === 0 ? CHAT_MESSAGE_ROLE.user : CHAT_MESSAGE_ROLE.assistant,
            content: `메시지 ${i}`,
            now: new Date("2026-01-01T00:00:00.000Z"),
        }),
    );
}

describe("SummarizeThreadProjection", () => {
    it("메시지 수가 문턱 이하면 아무것도 하지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const thread = seedThread(threads);
        const summarizer = new FakeChatSummarizer();
        const projection = new SummarizeThreadProjection(threads, summarizer, new FixedClock(NOW));

        await projection.project(thread, messagesOf(CHAT_SUMMARY_SPEC.triggerMessageCount));

        expect(summarizer.calls).toBe(0);
        expect((await threads.findById("th1"))?.summary).toBeNull();
    });

    it("문턱을 넘으면 오래된 메시지를 요약해 기존 요약과 합쳐 저장한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const thread = seedThread(threads, "이전 요약");
        const summarizer = new FakeChatSummarizer("갱신된 요약");
        const projection = new SummarizeThreadProjection(threads, summarizer, new FixedClock(NOW));

        const messages = messagesOf(CHAT_SUMMARY_SPEC.triggerMessageCount + 1);
        await projection.project(thread, messages);

        expect(summarizer.calls).toBe(1);
        expect(summarizer.lastRequest?.prompt).toContain("이전 요약");
        expect(summarizer.lastRequest?.prompt).toContain("메시지 0");
        // 최근 recentKeepCount개는 요약 프롬프트에 접히지 않는다.
        const firstKeptIndex = CHAT_SUMMARY_SPEC.triggerMessageCount - CHAT_SUMMARY_SPEC.recentKeepCount + 1;
        expect(summarizer.lastRequest?.prompt).not.toContain(`메시지 ${firstKeptIndex}`);

        const saved = await threads.findById("th1");
        expect(saved?.summary).toBe("갱신된 요약");
        expect(saved?.updatedAt).toEqual(NOW);
    });

    it("요약 호출이 실패해도 던지지 않고 기존 요약을 그대로 둔다", async () => {
        const threads = new InMemoryChatThreadRepository();
        const thread = seedThread(threads, "이전 요약");
        const summarizer = new FakeChatSummarizer("무시됨", new Error("boom"));
        const projection = new SummarizeThreadProjection(threads, summarizer, new FixedClock(NOW));

        await expect(
            projection.project(thread, messagesOf(CHAT_SUMMARY_SPEC.triggerMessageCount + 1)),
        ).resolves.toBeUndefined();

        expect((await threads.findById("th1"))?.summary).toBe("이전 요약");
    });
});
