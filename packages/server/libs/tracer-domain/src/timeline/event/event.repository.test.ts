import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { asRepository, createInMemoryRepository } from "@monitor/tracer-domain/__fixtures__/in-memory-repository.js";
import { EventEntity } from "./event.entity.js";
import { EventRepository } from "./event.repository.js";

function makeEvent(id: string, seq: string): EventEntity {
    const event = new EventEntity();
    event.id = id;
    event.seq = seq;
    event.userId = "u1";
    event.taskId = "t1";
    event.sessionId = null;
    event.turnId = null;
    event.kind = KIND.userMessage;
    event.lane = "user";
    event.title = id;
    event.body = null;
    event.toolName = null;
    event.filePaths = [];
    event.metadata = {};
    event.traceId = "trace-1";
    event.spanId = id;
    event.parentSpanId = null;
    event.occurredAt = new Date("2026-01-01T00:00:00.000Z");
    return event;
}

describe("EventRepository.findTimelineWindow 커서", () => {
    it("커서 없이 부르면 최신 seq부터 최대 limit개를 내림차순으로 반환한다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        repo.seed(makeEvent("e9", "9"), makeEvent("e10", "10"), makeEvent("e11", "11"));
        const repository = new EventRepository(asRepository(repo));

        const page = await repository.findTimelineWindow("t1", undefined, 2);

        // 자릿수가 갈리는 9와 10 사이에서도 수치 순서(11 > 10 > 9)를 지켜야 한다.
        expect(page.map((e) => e.seq)).toEqual(["11", "10"]);
    });

    it("커서 경계의 이벤트를 하나도 건너뛰거나 중복하지 않고 다음 페이지로 넘긴다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        repo.seed(
            makeEvent("e8", "8"),
            makeEvent("e9", "9"),
            makeEvent("e10", "10"),
            makeEvent("e11", "11"),
            makeEvent("e12", "12"),
        );
        const repository = new EventRepository(asRepository(repo));

        const page1 = await repository.findTimelineWindow("t1", undefined, 3);
        expect(page1.map((e) => e.seq)).toEqual(["12", "11", "10"]);

        const oldestInPage1 = page1.at(-1);
        if (oldestInPage1 === undefined) throw new Error("page1이 비어 있으면 안 된다");
        const page2 = await repository.findTimelineWindow("t1", oldestInPage1.seq, 3);

        // 경계 seq("10")는 page1에만 있고 page2에는 없어야 하며, 남은 8·9는 하나도 빠지지 않고 전부 나와야 한다.
        expect(page2.map((e) => e.seq)).toEqual(["9", "8"]);
    });

    it("다른 태스크의 이벤트는 섞이지 않는다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        const other = makeEvent("other-1", "5");
        other.taskId = "t2";
        repo.seed(makeEvent("e1", "1"), other);
        const repository = new EventRepository(asRepository(repo));

        const page = await repository.findTimelineWindow("t1", undefined, 10);

        expect(page.map((e) => e.id)).toEqual(["e1"]);
    });
});

describe("EventRepository.findByTaskSinceSeq", () => {
    it("주어진 seq부터(포함) 그 태스크의 이후 이벤트를 seq 오름차순으로 반환한다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        repo.seed(makeEvent("e1", "1"), makeEvent("e2", "2"), makeEvent("e3", "3"));
        const repository = new EventRepository(asRepository(repo));

        const events = await repository.findByTaskSinceSeq("t1", "2");

        expect(events.map((e) => e.id)).toEqual(["e2", "e3"]);
    });

    it("다른 태스크의 이벤트는 섞이지 않는다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        const other = makeEvent("other-1", "1");
        other.taskId = "t2";
        repo.seed(makeEvent("e1", "1"), other);
        const repository = new EventRepository(asRepository(repo));

        const events = await repository.findByTaskSinceSeq("t1", "1");

        expect(events.map((e) => e.id)).toEqual(["e1"]);
    });
});

describe("EventRepository.countByTask", () => {
    it("페이지 상한과 무관하게 해당 태스크의 전체 이벤트 수를 센다", async () => {
        const repo = createInMemoryRepository<EventEntity>();
        const other = makeEvent("other-1", "5");
        other.taskId = "t2";
        repo.seed(makeEvent("e1", "1"), makeEvent("e2", "2"), makeEvent("e3", "3"), other);
        const repository = new EventRepository(asRepository(repo));

        expect(await repository.countByTask("t1")).toBe(3);
        expect(await repository.countByTask("t2")).toBe(1);
    });
});
