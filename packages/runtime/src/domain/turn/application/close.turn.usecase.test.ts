import {KIND} from "@monitor/kernel";
import {AGENT_TRACER_ATTR, SEMCONV_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import {describe, expect, it} from "vitest";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";
import {InMemoryEventSink} from "~runtime/domain/ingest/port/__fakes__/in-memory.event.sink.js";
import {CloseTurnUsecase} from "~runtime/domain/turn/application/close.turn.usecase.js";

const KEY = bindingKey("claude-plugin", "cc-1");

const INPUT = {
    runtimeSource: "claude-plugin",
    runtimeSessionId: "cc-1",
    taskId: "task-1",
    sessionId: "session-1",
    agentName: "claude-plugin",
    stopReason: "end_turn",
    fallbackTurnId: "fallback-turn",
};

function bindingsWithTurn(): InMemoryBindingStore {
    return new InMemoryBindingStore({
        [KEY]: {
            taskId: "task-1",
            sessionId: "session-1",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "cc-1",
            createdAt: "2026-07-14T00:00:00.000Z",
            currentTurnId: "turn-2",
            turnStartedAt: "2026-07-14T00:00:00.000Z",
            previousTurnId: "turn-1",
            turnPrompt: "lint 돌려줘",
        },
    });
}

describe("CloseTurnUsecase", () => {
    it("열린 턴을 감싸는 invoke_agent span을 남긴다", async () => {
        const sink = new InMemoryEventSink();

        const turnId = await new CloseTurnUsecase(bindingsWithTurn(), sink, "claude-plugin")
            .execute({...INPUT, response: "끝났습니다"});

        expect(turnId).toBe("turn-2");
        const event = sink.events[0]!;
        expect(event.kind).toBe(KIND.invokeAgent);
        expect(event.id).toBe("turn-2");
        const metadata = event.payload["metadata"] as Record<string, unknown>;
        expect(metadata[SEMCONV_ATTR.responseFinishReasons]).toBe("end_turn");
        expect(metadata[AGENT_TRACER_ATTR.turnPreviousId]).toBe("turn-1");
    });

    it("턴이 열려 있지 않으면 대체 턴 ID로 세션 전체를 한 턴으로 본다", async () => {
        const sink = new InMemoryEventSink();

        const turnId = await new CloseTurnUsecase(new InMemoryBindingStore(), sink, "claude-plugin").execute(INPUT);

        expect(turnId).toBe("fallback-turn");
        const metadata = sink.events[0]?.payload["metadata"] as Record<string, unknown>;
        expect(metadata[SEMCONV_ATTR.inputMessages]).toBeUndefined();
    });
});
