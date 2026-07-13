import {describe, expect, it} from "vitest";
import {ReleaseBindingUsecase} from "~runtime/domain/binding/application/release.binding.usecase.js";
import {bindingKey} from "~runtime/domain/binding/model/binding.model.js";
import {InMemoryBindingStore} from "~runtime/domain/binding/port/__fakes__/in-memory.binding.store.js";

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

describe("ReleaseBindingUsecase", () => {
    it("끝난 런타임 세션의 바인딩을 지운다", async () => {
        const bindings = store();

        expect(await new ReleaseBindingUsecase(bindings).execute("claude-plugin", "cc-1")).toBe(true);
        expect(bindings.read()[KEY]).toBeUndefined();
    });

    it("이미 없는 바인딩은 지우지 않는다", async () => {
        const bindings = new InMemoryBindingStore();

        expect(await new ReleaseBindingUsecase(bindings).execute("claude-plugin", "cc-1")).toBe(false);
    });

    it("잠금을 못 잡으면 바인딩을 건드리지 않는다", async () => {
        const bindings = store();
        bindings.jamLock();

        expect(await new ReleaseBindingUsecase(bindings).execute("claude-plugin", "cc-1")).toBe(false);
        expect(bindings.read()[KEY]?.taskId).toBe("task-1");
    });
});
