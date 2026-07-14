import {KIND} from "@monitor/kernel";
import {describe, expect, it} from "vitest";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {SequentialIdGenerator} from "~runtime/domain/ingest/port/__fakes__/sequential.id.generator.js";
import {FixedClock} from "~runtime/domain/session/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");
import {EnsureSessionUsecase} from "~runtime/domain/session/application/ensure.session.usecase.js";

const INPUT = {runtimeSource: "claude-plugin", runtimeSessionId: "cc-1", title: "태스크"};

describe("EnsureSessionUsecase", () => {
    it("처음 보는 런타임 세션에 태스크를 만들고 session.started를 남긴다", async () => {
        const sink = new InMemoryEventSink();
        const usecase = new EnsureSessionUsecase(new InMemoryBindingStore(), sink, new SequentialIdGenerator(), new FixedClock(NOW));

        const ensured = await usecase.execute(INPUT);

        expect(ensured.taskCreated).toBe(true);
        expect(sink.events[0]?.kind).toBe(KIND.sessionStarted);
    });

    it("같은 런타임 세션을 다시 보면 같은 태스크를 복원한다", async () => {
        const bindings = new InMemoryBindingStore();
        const sink = new InMemoryEventSink();
        const usecase = new EnsureSessionUsecase(bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW));

        const first = await usecase.execute(INPUT);
        const second = await usecase.execute(INPUT);

        expect(second.taskCreated).toBe(false);
        expect(second.taskId).toBe(first.taskId);
        expect(sink.events).toHaveLength(1);
    });

    it("임시 제목으로 만든 태스크는 진짜 제목이 오면 task.linked로 한 번만 갱신한다", async () => {
        const bindings = new InMemoryBindingStore();
        const sink = new InMemoryEventSink();
        const usecase = new EnsureSessionUsecase(bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW));

        await usecase.execute({...INPUT, title: "Claude Code — repo", titled: false});
        await usecase.execute({...INPUT, title: "실제 제목"});
        await usecase.execute({...INPUT, title: "또 다른 제목"});

        const linked = sink.events.filter((event) => event.kind === KIND.taskLinked);
        expect(linked).toHaveLength(1);
        expect(linked[0]?.payload["title"]).toBe("실제 제목");
    });

    it("잠금을 못 잡고 기존 바인딩도 없으면 쓰지 않고 예외를 던진다", async () => {
        const bindings = new InMemoryBindingStore();
        bindings.jamLock();
        const sink = new InMemoryEventSink();

        await expect(new EnsureSessionUsecase(bindings, sink, new SequentialIdGenerator(), new FixedClock(NOW)).execute(INPUT)).rejects.toThrow();
        expect(sink.events).toHaveLength(0);
    });
});
