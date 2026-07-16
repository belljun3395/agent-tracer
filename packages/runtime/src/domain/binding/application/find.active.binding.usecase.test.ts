import {describe, expect, it} from "vitest";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {FindActiveBindingUsecase} from "~runtime/domain/binding/application/find.active.binding.usecase.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";

describe("FindActiveBindingUsecase", () => {
    it("바인딩이 없으면 undefined다", () => {
        const usecase = new FindActiveBindingUsecase(new InMemoryBindingStore());
        expect(usecase.execute()).toBeUndefined();
    });

    it("가장 최근에 턴이 열린 바인딩을 태스크로 낸다", () => {
        const store = new InMemoryBindingStore({
            [bindingKey("claude-plugin", "cc-1")]: {
                taskId: "task-old",
                sessionId: "session-old",
                runtimeSource: "claude-plugin",
                runtimeSessionId: "cc-1",
                createdAt: "2026-07-14T00:00:00.000Z",
                turnStartedAt: "2026-07-14T00:01:00.000Z",
            },
            [bindingKey("claude-plugin", "cc-2")]: {
                taskId: "task-new",
                sessionId: "session-new",
                runtimeSource: "claude-plugin",
                runtimeSessionId: "cc-2",
                createdAt: "2026-07-14T00:00:00.000Z",
                turnStartedAt: "2026-07-14T00:05:00.000Z",
            },
        });

        const usecase = new FindActiveBindingUsecase(store);

        expect(usecase.execute()?.taskId).toBe("task-new");
    });
});
