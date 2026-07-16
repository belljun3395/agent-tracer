import {describe, expect, it} from "vitest";
import {MarkToolStartUsecase} from "~runtime/domain/ingest/application/mark.tool.start.usecase.js";
import {InMemoryToolTiming} from "~runtime/domain/ingest/port/__fakes__/in-memory.tool.timing.js";
import {FixedClock} from "~runtime/domain/ingest/port/__fakes__/fixed.clock.js";

describe("MarkToolStartUsecase", () => {
    it("현재 시각으로 도구 호출 시작을 기록한다", () => {
        const timing = new InMemoryToolTiming();
        const usecase = new MarkToolStartUsecase(timing, new FixedClock(1_000));

        usecase.execute("session-1", "tool-use-1");

        expect(timing.takeStart("session-1", "tool-use-1")).toBe(1_000);
    });

    it("세션과 toolUseId 조합으로 서로 다른 시작을 구분한다", () => {
        const timing = new InMemoryToolTiming();
        const usecase = new MarkToolStartUsecase(timing, new FixedClock(500));

        usecase.execute("session-1", "tool-use-1");
        usecase.execute("session-2", "tool-use-1");

        expect(timing.takeStart("session-1", "tool-use-1")).toBe(500);
        expect(timing.takeStart("session-2", "tool-use-1")).toBe(500);
    });
});
