import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {RecordToolFailureUsecase} from "~runtime/domain/ingest/application/record.tool.failure.usecase.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/ingest/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

const TARGET = {taskId: "task-1", sessionId: "session-1"};

function usecase(sink: InMemoryEventSink): RecordToolFailureUsecase {
    return new RecordToolFailureUsecase(sink, new SequentialIdGenerator(), new FixedClock(NOW), "claude-plugin", {projectDir: "/repo"});
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
});
