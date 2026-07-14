import {KIND} from "@monitor/kernel";
import {AGENT_TRACER_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {AppendEventsUsecase} from "~runtime/domain/ingest/application/append.events.usecase.js";
import {LANE} from "~runtime/domain/ingest/model/event.model.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/ingest/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

describe("AppendEventsUsecase", () => {
    it("런타임 이벤트에 출처 속성과 태그를 붙여 스풀에 넣는다", async () => {
        const sink = new InMemoryEventSink();

        await new AppendEventsUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW), "claude-plugin").execute([{
            kind: KIND.executeTool,
            taskId: "task-1",
            lane: LANE.implementation,
            title: "npm test",
            metadata: {subtypeKey: "run_test"},
        }]);

        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata[AGENT_TRACER_ATTR.runtimeSource]).toBe("claude-plugin");
        expect(metadata["tags"]).toContain("subtype:run-test");
    });

    it("payload가 고정된 이벤트는 봉투만 씌워 그대로 보낸다", async () => {
        const sink = new InMemoryEventSink();

        await new AppendEventsUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW), "claude-plugin").execute([{
            kind: KIND.sessionEnded,
            taskId: "task-1",
            payload: {summary: "끝"},
        }]);

        expect(sink.events[0]?.payload).toEqual({summary: "끝"});
    });

    it("이벤트가 없으면 스풀을 건드리지 않는다", async () => {
        const sink = new InMemoryEventSink();

        await new AppendEventsUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW), "claude-plugin").execute([]);

        expect(sink.events).toHaveLength(0);
    });
});
