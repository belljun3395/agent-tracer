import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {bindingKey, type BindingRecord} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/session/port/__fakes__/fixed.clock.js";
import {ClearSessionUsecase} from "~runtime/domain/session/application/clear.session.usecase.js";
import {EnsureSessionUsecase} from "~runtime/domain/session/application/ensure.session.usecase.js";
import {subagentSessionId} from "~runtime/domain/session/model/session.event.model.js";

const NOW = Date.parse("2026-07-16T04:00:00.000Z");
const INPUT = {runtimeSource: "claude-plugin", runtimeSessionId: "cc-1", title: "태스크"};

function startedEvents(sink: InMemoryEventSink) {
    return sink.events.filter((event) => event.kind === KIND.sessionStarted);
}

function endedEvents(sink: InMemoryEventSink) {
    return sink.events.filter((event) => event.kind === KIND.sessionEnded);
}

describe("ClearSessionUsecase", () => {
    it("독립된 새 태스크를 만들고 sessionStarted를 남긴다", async () => {
        const sink = new InMemoryEventSink();
        const cleared = await new ClearSessionUsecase(
            new InMemoryBindingStore(), sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(INPUT);

        expect(cleared.taskCreated).toBe(true);
        const started = startedEvents(sink);
        expect(started).toHaveLength(1);
        expect(started[0]?.taskId).toBe(cleared.taskId);
    });

    it("같은 런타임 세션에 바인딩이 있어도 상속 없이 새 taskId로 회전하고 종료 이벤트는 남기지 않는다", async () => {
        const bindings = new InMemoryBindingStore();
        const sink = new InMemoryEventSink();
        const ids = new SequentialIdGenerator();
        const first = await new EnsureSessionUsecase(bindings, sink, ids, new FixedClock(NOW)).execute(INPUT);

        const cleared = await new ClearSessionUsecase(bindings, sink, ids, new FixedClock(NOW)).execute(INPUT);

        expect(cleared.taskId).not.toBe(first.taskId);
        expect(sink.events.filter((event) => event.kind === KIND.sessionEnded)).toHaveLength(0);
        expect(bindings.read()[bindingKey("claude-plugin", "cc-1")]?.taskId).toBe(cleared.taskId);
    });

    it("새 태스크는 부모나 resume 없이 완전히 독립이다", async () => {
        const sink = new InMemoryEventSink();
        const cleared = await new ClearSessionUsecase(
            new InMemoryBindingStore(), sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(INPUT);

        const started = startedEvents(sink)[0];
        expect(started?.taskId).toBe(cleared.taskId);
        expect(started?.payload).not.toHaveProperty("parentSessionId");
        expect(started?.payload).not.toHaveProperty("parentTaskId");
        expect(started?.payload).not.toHaveProperty("resume");
    });
});

const WORKSPACE = "/Users/dev/project-a";
const CLEAR_INPUT = {...INPUT, runtimeSessionId: "cc-2", workspacePath: WORKSPACE};

function predecessorBinding(overrides: Partial<BindingRecord> = {}): BindingRecord {
    return {
        taskId: "predecessor-task",
        sessionId: "predecessor-session",
        runtimeSource: "claude-plugin",
        runtimeSessionId: "cc-old",
        workspacePath: WORKSPACE,
        createdAt: "2026-07-16T03:00:00.000Z",
        ...overrides,
    };
}

describe("ClearSessionUsecase - 직전 태스크 종료", () => {
    it("같은 워크스페이스의 직전 태스크를 sessionEnded로 닫고 그 뒤에 새 태스크를 연다", async () => {
        const predecessor = predecessorBinding();
        const bindings = new InMemoryBindingStore({[bindingKey(predecessor.runtimeSource, predecessor.runtimeSessionId)]: predecessor});
        const sink = new InMemoryEventSink();
        const cleared = await new ClearSessionUsecase(
            bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        const ended = endedEvents(sink);
        expect(ended).toHaveLength(1);
        expect(ended[0]?.taskId).toBe(predecessor.taskId);
        expect(ended[0]?.sessionId).toBe(predecessor.sessionId);
        expect(ended[0]?.payload.completeTask).toBe(true);
        expect(ended[0]?.payload.completionReason).toBe("cleared");

        const started = startedEvents(sink);
        expect(started).toHaveLength(1);
        expect(started[0]?.taskId).toBe(cleared.taskId);

        const endedIndex = sink.events.findIndex((event) => event.kind === KIND.sessionEnded);
        const startedIndex = sink.events.findIndex((event) => event.kind === KIND.sessionStarted);
        expect(endedIndex).toBeLessThan(startedIndex);
    });

    it("워크스페이스가 다른 바인딩은 닫지 않는다", async () => {
        const predecessor = predecessorBinding({workspacePath: "/Users/dev/other-project"});
        const bindings = new InMemoryBindingStore({[bindingKey(predecessor.runtimeSource, predecessor.runtimeSessionId)]: predecessor});
        const sink = new InMemoryEventSink();
        await new ClearSessionUsecase(
            bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        expect(endedEvents(sink)).toHaveLength(0);
        expect(startedEvents(sink)).toHaveLength(1);
    });

    it("가장 최근 바인딩이 서브에이전트면 건너뛰고 그보다 오래된 비-서브에이전트 바인딩을 닫는다", async () => {
        const primary = predecessorBinding({
            taskId: "primary-task",
            sessionId: "primary-session",
            runtimeSessionId: "cc-old",
            createdAt: "2026-07-16T02:00:00.000Z",
        });
        const subagent = predecessorBinding({
            taskId: "subagent-task",
            sessionId: "subagent-session",
            runtimeSessionId: subagentSessionId("agent-1"),
            createdAt: "2026-07-16T03:30:00.000Z",
        });
        const bindings = new InMemoryBindingStore({
            [bindingKey(primary.runtimeSource, primary.runtimeSessionId)]: primary,
            [bindingKey(subagent.runtimeSource, subagent.runtimeSessionId)]: subagent,
        });
        const sink = new InMemoryEventSink();
        await new ClearSessionUsecase(
            bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        const ended = endedEvents(sink);
        expect(ended).toHaveLength(1);
        expect(ended[0]?.taskId).toBe(primary.taskId);
    });

    it("서브에이전트 바인딩만 있으면 아무것도 닫지 않는다", async () => {
        const subagent = predecessorBinding({
            taskId: "subagent-task",
            sessionId: "subagent-session",
            runtimeSessionId: subagentSessionId("agent-1"),
        });
        const bindings = new InMemoryBindingStore({[bindingKey(subagent.runtimeSource, subagent.runtimeSessionId)]: subagent});
        const sink = new InMemoryEventSink();
        await new ClearSessionUsecase(
            bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        expect(endedEvents(sink)).toHaveLength(0);
        expect(startedEvents(sink)).toHaveLength(1);
    });

    it("워크스페이스에 직전 바인딩이 없으면 sessionStarted만 남긴다", async () => {
        const sink = new InMemoryEventSink();
        await new ClearSessionUsecase(
            new InMemoryBindingStore(), sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        expect(endedEvents(sink)).toHaveLength(0);
        expect(startedEvents(sink)).toHaveLength(1);
    });

    it("새로 만든 바인딩에 workspacePath가 저장된다", async () => {
        const bindings = new InMemoryBindingStore();
        const sink = new InMemoryEventSink();
        const cleared = await new ClearSessionUsecase(
            bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW),
        ).execute(CLEAR_INPUT);

        const key = bindingKey(CLEAR_INPUT.runtimeSource, CLEAR_INPUT.runtimeSessionId);
        expect(bindings.read()[key]?.workspacePath).toBe(WORKSPACE);
        expect(bindings.read()[key]?.taskId).toBe(cleared.taskId);
    });
});
