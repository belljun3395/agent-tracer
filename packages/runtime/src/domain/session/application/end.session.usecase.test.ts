import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {EndSessionUsecase} from "~runtime/domain/session/application/end.session.usecase.js";

describe("EndSessionUsecase", () => {
    it("종료 사유와 태스크 완료 여부를 payload에 실어 남긴다", async () => {
        const sink = new InMemoryEventSink();

        await new EndSessionUsecase(sink).execute({
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
