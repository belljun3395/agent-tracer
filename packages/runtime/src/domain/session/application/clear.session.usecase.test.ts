import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/session/port/__fakes__/fixed.clock.js";
import {ClearSessionUsecase} from "~runtime/domain/session/application/clear.session.usecase.js";
import {EnsureSessionUsecase} from "~runtime/domain/session/application/ensure.session.usecase.js";

const NOW = Date.parse("2026-07-16T04:00:00.000Z");
const INPUT = {runtimeSource: "claude-plugin", runtimeSessionId: "cc-1", title: "태스크"};

function startedEvents(sink: InMemoryEventSink) {
    return sink.events.filter((event) => event.kind === KIND.sessionStarted);
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
