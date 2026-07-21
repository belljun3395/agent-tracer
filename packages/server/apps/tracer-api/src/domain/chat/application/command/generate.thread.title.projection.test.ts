import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity, ChatThreadEntity } from "@monitor/tracer-domain";
import { InMemoryChatThreadRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { FakeChatSummarizer } from "~tracer-api/domain/chat/port/__fakes__/fake.chat.summarizer.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { CHAT_DEFAULT_THREAD_TITLE } from "~tracer-api/domain/chat/model/chat.title.spec.js";
import { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";

const NOW = new Date("2026-01-03T00:00:00.000Z");
const OLD = new Date("2026-01-01T00:00:00.000Z");

function seedThread(threads: InMemoryChatThreadRepository, title: string): ChatThreadEntity {
    const thread = ChatThreadEntity.create({ id: "th1", userId: "u1", title, now: OLD });
    threads.seed(thread);
    return thread;
}

function messages(): ChatMessageEntity[] {
    return [
        ChatMessageEntity.create({ id: "m1", threadId: "th1", role: CHAT_MESSAGE_ROLE.user, content: "다음 주 발표 자료 검토해줘", now: OLD }),
        ChatMessageEntity.create({ id: "m2", threadId: "th1", role: CHAT_MESSAGE_ROLE.assistant, content: "네, 살펴볼게요", now: OLD }),
    ];
}

describe("GenerateThreadTitleProjection", () => {
    it("기본 제목이면 요약해 제목을 붙이고 스레드를 갱신한다", async () => {
        const threads = new InMemoryChatThreadRepository();
        seedThread(threads, CHAT_DEFAULT_THREAD_TITLE);
        const summarizer = new FakeChatSummarizer("발표 자료 검토");
        const projection = new GenerateThreadTitleProjection(threads, summarizer, new FixedClock(NOW));

        await projection.project((await threads.findById("th1"))!, messages());

        expect(summarizer.calls).toBe(1);
        expect(summarizer.lastRequest?.prompt).toContain("다음 주 발표 자료 검토해줘");
        const saved = await threads.findById("th1");
        expect(saved?.title).toBe("발표 자료 검토");
        expect(saved?.updatedAt).toEqual(NOW);
    });

    it("제목이 기본값이 아니면 다시 생성하지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        seedThread(threads, "이미 지은 제목");
        const summarizer = new FakeChatSummarizer("새 제목");
        const projection = new GenerateThreadTitleProjection(threads, summarizer, new FixedClock(NOW));

        await projection.project((await threads.findById("th1"))!, messages());

        expect(summarizer.calls).toBe(0);
        expect((await threads.findById("th1"))?.title).toBe("이미 지은 제목");
    });

    it("생성한 제목이 최대 길이를 넘으면 잘라낸다", async () => {
        const threads = new InMemoryChatThreadRepository();
        seedThread(threads, CHAT_DEFAULT_THREAD_TITLE);
        const long = "가".repeat(80);
        const summarizer = new FakeChatSummarizer(long);
        const projection = new GenerateThreadTitleProjection(threads, summarizer, new FixedClock(NOW));

        await projection.project((await threads.findById("th1"))!, messages());

        expect((await threads.findById("th1"))?.title).toHaveLength(40);
    });

    it("제목 생성이 실패해도 던지지 않고 기본 제목을 그대로 둔다", async () => {
        const threads = new InMemoryChatThreadRepository();
        seedThread(threads, CHAT_DEFAULT_THREAD_TITLE);
        const summarizer = new FakeChatSummarizer("무시됨", new Error("boom"));
        const projection = new GenerateThreadTitleProjection(threads, summarizer, new FixedClock(NOW));

        await expect(projection.project((await threads.findById("th1"))!, messages())).resolves.toBeUndefined();

        expect((await threads.findById("th1"))?.title).toBe(CHAT_DEFAULT_THREAD_TITLE);
    });

    it("빈 제목이 나오면 스레드를 건드리지 않는다", async () => {
        const threads = new InMemoryChatThreadRepository();
        seedThread(threads, CHAT_DEFAULT_THREAD_TITLE);
        const summarizer = new FakeChatSummarizer("   ");
        const projection = new GenerateThreadTitleProjection(threads, summarizer, new FixedClock(NOW));

        await projection.project((await threads.findById("th1"))!, messages());

        expect((await threads.findById("th1"))?.title).toBe(CHAT_DEFAULT_THREAD_TITLE);
        expect((await threads.findById("th1"))?.updatedAt).toEqual(OLD);
    });
});
