import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/session/port/__fakes__/fixed.clock.js";
import {SetTaskTitleUsecase} from "~runtime/domain/session/application/set.task.title.usecase.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

describe("SetTaskTitleUsecase", () => {
    it("태스크와 제목이 있으면 taskLinked 이벤트를 남긴다", async () => {
        const sink = new InMemoryEventSink();
        const usecase = new SetTaskTitleUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW));

        const ok = await usecase.execute("task-1", "  로그인 흐름 리팩터링  ");

        expect(ok).toBe(true);
        expect(sink.events[0]?.kind).toBe(KIND.taskLinked);
        expect(sink.events[0]?.taskId).toBe("task-1");
        expect(sink.events[0]?.payload["title"]).toBe("로그인 흐름 리팩터링");
    });

    it("태스크나 제목이 비어 있으면 이벤트를 남기지 않는다", async () => {
        const sink = new InMemoryEventSink();
        const usecase = new SetTaskTitleUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW));

        expect(await usecase.execute("", "제목")).toBe(false);
        expect(await usecase.execute("task-1", "   ")).toBe(false);
        expect(sink.events).toHaveLength(0);
    });
});
