import {describe, expect, it} from "vitest";
import {ReadBindingUsecase} from "~runtime/domain/binding/application/read.binding.usecase.js";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";

const KEY = bindingKey("claude-plugin", "cc-1");

const BINDING = {
    taskId: "task-1",
    sessionId: "session-1",
    runtimeSource: "claude-plugin",
    runtimeSessionId: "cc-1",
    createdAt: "2026-07-14T00:00:00.000Z",
};

describe("ReadBindingUsecase", () => {
    it("런타임 세션으로 태스크와 세션을 찾는다", () => {
        const usecase = new ReadBindingUsecase(new InMemoryBindingStore({[KEY]: BINDING}));

        const bound = usecase.execute("claude-plugin", "cc-1");

        expect(bound?.taskId).toBe("task-1");
        expect(bound?.sessionId).toBe("session-1");
        expect(bound?.startedAt).toBe("2026-07-14T00:00:00.000Z");
        expect(bound?.turnId).toBeUndefined();
    });

    it("열린 턴이 있으면 턴 상태까지 함께 낸다", () => {
        const store = new InMemoryBindingStore({
            [KEY]: {
                ...BINDING,
                currentTurnId: "turn-1",
                turnStartedAt: "2026-07-14T00:01:00.000Z",
                turnPrompt: "lint 돌려줘",
            },
        });

        const bound = new ReadBindingUsecase(store).execute("claude-plugin", "cc-1");

        expect(bound?.turnId).toBe("turn-1");
        expect(bound?.turn?.prompt).toBe("lint 돌려줘");
        expect(bound?.turn?.startedAt).toBe("2026-07-14T00:01:00.000Z");
    });

    it("관측한 적 없는 런타임 세션은 바인딩이 없다", () => {
        const usecase = new ReadBindingUsecase(new InMemoryBindingStore());

        expect(usecase.execute("claude-plugin", "cc-1")).toBeUndefined();
    });
});
