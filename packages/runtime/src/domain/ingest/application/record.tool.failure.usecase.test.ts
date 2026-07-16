import {KIND} from "@monitor/kernel";
import {AGENT_TRACER_ATTR, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {RecordToolFailureUsecase} from "~runtime/domain/ingest/application/record.tool.failure.usecase.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {InMemoryToolTiming} from "~runtime/domain/ingest/port/__fakes__/in-memory.tool.timing.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/ingest/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

const TARGET = {taskId: "task-1", sessionId: "session-1"};

function usecase(
    sink: InMemoryEventSink,
    timing: InMemoryToolTiming = new InMemoryToolTiming(),
    clock: FixedClock = new FixedClock(NOW),
): RecordToolFailureUsecase {
    return new RecordToolFailureUsecase(sink, timing, new SequentialIdGenerator(), clock, "claude-plugin", {projectDir: "/repo"});
}

describe("RecordToolFailureUsecase", () => {
    it("실패한 Bash 호출을 명령과 함께 도구 실행 이벤트로 남긴다", async () => {
        const sink = new InMemoryEventSink();

        await usecase(sink).execute({
            toolName: "Bash",
            toolInput: {command: "npm test"},
            error: "exit 1",
            isInterrupt: false,
        }, TARGET);

        const event = sink.events[0]!;
        expect(event.kind).toBe(KIND.executeTool);
        expect(event.payload["command"]).toBe("npm test");
    });

    it("수집기 자신을 부르는 MCP 실패는 기록하지 않는다", async () => {
        const sink = new InMemoryEventSink();

        await usecase(sink).execute({
            toolName: "mcp__agent-tracer__get_events",
            toolInput: {},
            error: "boom",
            isInterrupt: false,
        }, TARGET);

        expect(sink.events).toHaveLength(0);
    });

    it("실패 문자열을 규칙 테이블로 분류해 errorType을 싣는다", async () => {
        const sink = new InMemoryEventSink();

        await usecase(sink).execute({
            toolName: "Bash",
            toolInput: {command: "cat missing.txt"},
            error: "cat: missing.txt: No such file or directory",
            isInterrupt: false,
        }, TARGET);

        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata[SEMCONV_ATTR.errorType]).toBe("not_found");
    });

    it("PreToolUse가 남긴 시작 시각이 있으면 durationMs를 싣고 소거한다", async () => {
        const sink = new InMemoryEventSink();
        const timing = new InMemoryToolTiming();
        timing.markStart(TARGET.sessionId, "tool-use-1", NOW - 300);

        await usecase(sink, timing).execute({
            toolName: "Bash",
            toolInput: {command: "npm test"},
            toolUseId: "tool-use-1",
            error: "exit 1",
            isInterrupt: false,
        }, TARGET);

        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata[AGENT_TRACER_ATTR.durationMs]).toBe(300);
        expect(timing.takeStart(TARGET.sessionId, "tool-use-1")).toBeUndefined();
    });

    it("시작 기록이 없으면 durationMs를 싣지 않는다", async () => {
        const sink = new InMemoryEventSink();

        await usecase(sink).execute({
            toolName: "Bash",
            toolInput: {command: "npm test"},
            toolUseId: "tool-use-1",
            error: "exit 1",
            isInterrupt: false,
        }, TARGET);

        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata).not.toHaveProperty(AGENT_TRACER_ATTR.durationMs);
    });

    it("시계가 역행해 소요 시간이 음수면 durationMs를 싣지 않는다", async () => {
        const sink = new InMemoryEventSink();
        const timing = new InMemoryToolTiming();
        timing.markStart(TARGET.sessionId, "tool-use-1", NOW + 1_000);

        await usecase(sink, timing).execute({
            toolName: "Bash",
            toolInput: {command: "npm test"},
            toolUseId: "tool-use-1",
            error: "exit 1",
            isInterrupt: false,
        }, TARGET);

        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata).not.toHaveProperty(AGENT_TRACER_ATTR.durationMs);
    });
});
