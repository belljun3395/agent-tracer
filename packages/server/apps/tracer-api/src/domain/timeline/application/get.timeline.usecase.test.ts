import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { EventEntity, TaskEntity } from "@monitor/tracer-domain";
import { InMemoryTimelineEventReader } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.event.reader.js";
import { InMemoryTimelineTaskReader } from "~tracer-api/domain/timeline/port/__fakes__/in-memory.task.reader.js";
import { GetTimelineUseCase } from "./get.timeline.usecase.js";

function makeTask(id: string, userId: string): TaskEntity {
    const task = new TaskEntity();
    task.id = id;
    task.userId = userId;
    return task;
}

function makeEvent(id: string, seq: string, taskId: string): EventEntity {
    const event = new EventEntity();
    event.id = id;
    event.seq = seq;
    event.userId = "u1";
    event.taskId = taskId;
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

function makeUseCase(tasks: TaskEntity[], events: EventEntity[] = []): GetTimelineUseCase {
    const taskRepo = new InMemoryTimelineTaskReader();
    taskRepo.seed(...tasks);
    const eventRepo = new InMemoryTimelineEventReader();
    eventRepo.seed(...events);
    return new GetTimelineUseCase(taskRepo, eventRepo);
}

describe("GetTimelineUseCase", () => {
    it("소유한 태스크의 타임라인 페이지를 반환한다", async () => {
        const useCase = makeUseCase([makeTask("t1", "u1")]);
        const result = await useCase.execute({ userId: "u1", taskId: "t1" });
        expect(result).toEqual({ items: [], nextCursor: null });
    });

    it("남의 태스크 타임라인은 존재하지 않는 것처럼 null을 반환한다", async () => {
        const useCase = makeUseCase([makeTask("t1", "u1")]);
        expect(await useCase.execute({ userId: "u2", taskId: "t1" })).toBeNull();
    });

    it("없는 태스크는 null을 반환한다", async () => {
        const useCase = makeUseCase([]);
        expect(await useCase.execute({ userId: "u1", taskId: "missing" })).toBeNull();
    });

    it("커서 없이 부르면 최신 이벤트부터 최대 limit개를 오름차순으로 반환한다", async () => {
        const events = [1, 2, 3, 4, 5].map((n) => makeEvent(`e${n}`, String(n), "t1"));
        const useCase = makeUseCase([makeTask("t1", "u1")], events);

        const result = await useCase.execute({ userId: "u1", taskId: "t1", limit: 3 });

        expect(result?.items.map((item) => item.id)).toEqual(["e3", "e4", "e5"]);
        expect(result?.nextCursor).toBe("3");
    });

    it("서버 커서 페이지네이션이 경계에서 이벤트를 빠뜨리거나 중복하지 않는다", async () => {
        const events = [1, 2, 3, 4, 5].map((n) => makeEvent(`e${n}`, String(n), "t1"));
        const useCase = makeUseCase([makeTask("t1", "u1")], events);

        const page1 = await useCase.execute({ userId: "u1", taskId: "t1", limit: 3 });
        const nextCursor = page1?.nextCursor;
        if (nextCursor === null || nextCursor === undefined) {
            throw new Error("page1에 다음 커서가 있어야 한다");
        }
        const page2 = await useCase.execute({ userId: "u1", taskId: "t1", cursor: nextCursor, limit: 3 });

        expect(page2?.items.map((item) => item.id)).toEqual(["e1", "e2"]);
        expect(page2?.nextCursor).toBeNull();
        const combined = [...(page2?.items ?? []), ...(page1?.items ?? [])].map((item) => item.id);
        expect(combined).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    });
});
