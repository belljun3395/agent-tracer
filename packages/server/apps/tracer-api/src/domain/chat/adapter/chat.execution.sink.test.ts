import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatExecutionEntity } from "@monitor/tracer-domain";
import { ChatExecutionEvents } from "~tracer-api/domain/chat/adapter/chat.execution.events.js";
import { InMemoryChatExecutionRepository } from "~tracer-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { FixedClock } from "~tracer-api/domain/chat/port/__fakes__/fixed.clock.js";
import { ChatScheduler } from "./chat.scheduler.js";
import { ChatExecutionSinkFactory } from "./chat.execution.sink.js";

const NOW = new Date("2026-07-22T00:00:00.000Z");

function build() {
    const executions = new InMemoryChatExecutionRepository();
    const execution = ChatExecutionEntity.create({
        userId: "u1",
        threadId: "t1",
        userMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h1",
        requestedBackend: null,
        model: null,
        language: null,
        now: NOW,
    });
    execution.start(NOW);
    executions.seed(execution);
    const events = new ChatExecutionEvents();
    const listener = vi.fn();
    events.subscribe(execution.id, listener);
    const handle = new ChatExecutionSinkFactory(
        executions,
        new FixedClock(NOW),
        new ChatScheduler(),
        events,
    ).create(execution.id);
    return { execution, executions, handle, listener };
}

describe("ChatExecutionSinkFactory", () => {
    beforeEach(() => vi.useFakeTimers());

    it("짧은 delta를 누적해 한 checkpoint로 저장하고 성공한 저장만 알린다", async () => {
        const { execution, executions, handle, listener } = build();
        await handle.sink.onAssistantDelta("안");
        await handle.sink.onAssistantDelta("녕");

        await vi.advanceTimersByTimeAsync(150);

        expect((await executions.findById(execution.id))?.draftText).toBe("안녕");
        expect((await executions.findById(execution.id))?.draftSeq).toBe(2);
        expect(listener).toHaveBeenCalledOnce();
    });

    it("flush는 예약 타이머를 취소하고 마지막 delta 저장을 기다린다", async () => {
        const { execution, executions, handle } = build();
        await handle.sink.onAssistantDelta("마지막");

        await handle.flush();
        await vi.runAllTimersAsync();

        expect((await executions.findById(execution.id))?.draftText).toBe("마지막");
        expect((await executions.findById(execution.id))?.draftSeq).toBe(1);
    });

    it("취소된 실행의 checkpoint와 일반 tool 신호는 상태를 바꾸지 않는다", async () => {
        const { execution, executions, handle, listener } = build();
        await executions.cancelActive(execution.id, NOW);
        await handle.sink.onToolCall({ id: "c1", name: "read", args: {} });
        await handle.sink.onToolResult({ toolCallId: "c1", toolName: "read", content: "ok" });
        await handle.sink.onAssistantDelta("버림");

        await handle.flush();

        expect((await executions.findById(execution.id))?.draftText).toBe("");
        expect(listener).not.toHaveBeenCalled();
    });
});
