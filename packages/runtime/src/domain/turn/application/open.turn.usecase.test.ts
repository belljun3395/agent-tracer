import {describe, expect, it} from "vitest";
import {bindingKey, turnStateOf} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";
import {OpenTurnUsecase} from "~runtime/domain/turn/application/open.turn.usecase.js";
import {FixedClock} from "~runtime/domain/turn/port/__fakes__/fixed.clock.js";

const NOW = Date.parse("2026-07-14T04:00:00.000Z");

const KEY = bindingKey("claude-plugin", "cc-1");

function store(): InMemoryBindingStore {
    return new InMemoryBindingStore({
        [KEY]: {
            taskId: "task-1",
            sessionId: "session-1",
            runtimeSource: "claude-plugin",
            runtimeSessionId: "cc-1",
            createdAt: "2026-07-14T00:00:00.000Z",
        },
    });
}

function openInput(turnId: string, prompt: string) {
    return {runtimeSource: "claude-plugin", runtimeSessionId: "cc-1", turnId, prompt};
}

describe("OpenTurnUsecase", () => {
    it("사용자 발화가 턴을 열고 프롬프트를 함께 남긴다", async () => {
        const bindings = store();

        await new OpenTurnUsecase(bindings, new FixedClock(NOW)).execute(openInput("turn-1", "lint 돌려줘"));

        const turn = turnStateOf(bindings.read()[KEY]);
        expect(turn?.turnId).toBe("turn-1");
        expect(turn?.prompt).toBe("lint 돌려줘");
        expect(turn?.previousTurnId).toBeUndefined();
    });

    it("다음 턴이 열리면 직전 턴 ID를 넘겨받는다", async () => {
        const bindings = store();
        const usecase = new OpenTurnUsecase(bindings, new FixedClock(NOW));

        await usecase.execute(openInput("turn-1", "첫 발화"));
        await usecase.execute(openInput("turn-2", "둘째 발화"));

        expect(turnStateOf(bindings.read()[KEY])?.previousTurnId).toBe("turn-1");
    });

    it("바인딩이 없으면 턴 상태를 남기지 않는다", async () => {
        const bindings = new InMemoryBindingStore();

        await new OpenTurnUsecase(bindings, new FixedClock(NOW)).execute(openInput("turn-1", "p"));

        expect(bindings.read()[KEY]).toBeUndefined();
    });

    it("잠금을 못 잡으면 턴 추적만 포기하고 예외를 던지지 않는다", async () => {
        const bindings = store();
        bindings.jamLock();

        await expect(new OpenTurnUsecase(bindings, new FixedClock(NOW)).execute(openInput("turn-1", "p"))).resolves.toBeUndefined();
        expect(turnStateOf(bindings.read()[KEY])).toBeUndefined();
    });
});
