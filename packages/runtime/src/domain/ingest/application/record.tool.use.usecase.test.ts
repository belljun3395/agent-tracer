import {KIND} from "@monitor/kernel";
import {AGENT_TRACER_ATTR, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {RecordToolUseUsecase} from "~runtime/domain/ingest/application/record.tool.use.usecase.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {InMemoryToolTiming} from "~runtime/domain/ingest/port/__fakes__/in-memory.tool.timing.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/ingest/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

const TARGET = {taskId: "task-1", sessionId: "session-1", turnId: "turn-1"};
const CONTEXT = {projectDir: "/repo"};

function usecase(
    sink: InMemoryEventSink,
    timing: InMemoryToolTiming = new InMemoryToolTiming(),
    clock: FixedClock = new FixedClock(NOW),
): RecordToolUseUsecase {
    return new RecordToolUseUsecase(sink, timing, new SequentialIdGenerator(), clock, "claude-plugin", CONTEXT);
}

describe("RecordToolUseUsecase", () => {
    it("Bash 호출을 execute_tool 이벤트로 만들어 턴에 붙인다", async () => {
        const sink = new InMemoryEventSink();

        const shaped = await usecase(sink).execute(
            {toolName: "Bash", toolInput: {command: "npm test"}, toolResponse: {exit_code: 0}},
            TARGET,
        );

        expect(shaped?.kind).toBe(KIND.executeTool);
        const event = sink.events[0]!;
        expect(event.turnId).toBe("turn-1");
        const metadata = event.payload["metadata"] as Record<string, unknown>;
        expect(metadata[SEMCONV_ATTR.toolName]).toBe("Bash");
        expect(metadata[AGENT_TRACER_ATTR.command]).toBe("npm test");
    });

    it("조형할 수 없는 도구는 아무 이벤트도 만들지 않는다", async () => {
        const sink = new InMemoryEventSink();

        expect(await usecase(sink).execute({toolName: "Unknown", toolInput: {}}, TARGET)).toBeNull();
        expect(sink.events).toHaveLength(0);
    });

    it("수집기 자신을 부르는 MCP 도구는 기록하지 않는다", async () => {
        const sink = new InMemoryEventSink();

        expect(await usecase(sink).execute(
            {toolName: "mcp__agent-tracer__get_events", toolInput: {}},
            TARGET,
        )).toBeNull();
        expect(sink.events).toHaveLength(0);
    });

    it("PreToolUse가 남긴 시작 시각이 있으면 durationMs를 싣고 소거한다", async () => {
        const sink = new InMemoryEventSink();
        const timing = new InMemoryToolTiming();
        timing.markStart(TARGET.sessionId, "tool-use-1", NOW - 500);

        const shaped = await usecase(sink, timing).execute(
            {toolName: "Bash", toolInput: {command: "npm test"}, toolUseId: "tool-use-1"},
            TARGET,
        );

        const metadata = shaped?.metadata as Record<string, unknown>;
        expect(metadata["durationMs"]).toBe(500);
        expect(timing.takeStart(TARGET.sessionId, "tool-use-1")).toBeUndefined();
    });

    it("시작 기록이 없으면 durationMs를 싣지 않는다", async () => {
        const sink = new InMemoryEventSink();

        const shaped = await usecase(sink).execute(
            {toolName: "Bash", toolInput: {command: "npm test"}, toolUseId: "tool-use-1"},
            TARGET,
        );

        expect(shaped?.metadata).not.toHaveProperty("durationMs");
    });

    it("시계가 역행해 소요 시간이 음수면 durationMs를 싣지 않는다", async () => {
        const sink = new InMemoryEventSink();
        const timing = new InMemoryToolTiming();
        timing.markStart(TARGET.sessionId, "tool-use-1", NOW + 1_000);

        const shaped = await usecase(sink, timing).execute(
            {toolName: "Bash", toolInput: {command: "npm test"}, toolUseId: "tool-use-1"},
            TARGET,
        );

        expect(shaped?.metadata).not.toHaveProperty("durationMs");
    });
});
