import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/session/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");
import {EndSessionUsecase} from "~runtime/domain/session/application/end.session.usecase.js";

describe("EndSessionUsecase", () => {
    it("종료 사유와 태스크 완료 여부를 payload에 실어 남긴다", async () => {
        const sink = new InMemoryEventSink();

        await new EndSessionUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW)).execute({
            taskId: "task-1",
            sessionId: "session-1",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "cc-1",
            summary: "세션 종료",
            completionReason: "explicit_exit",
            completeTask: true,
        });

        const event = sink.events[0]!;
        expect(event.kind).toBe(KIND.sessionEnded);
        expect(event.payload["completionReason"]).toBe("explicit_exit");
        expect(event.payload["completeTask"]).toBe(true);
    });
});
