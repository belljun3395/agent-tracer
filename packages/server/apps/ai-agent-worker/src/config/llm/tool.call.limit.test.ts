import { describe, expect, it } from "vitest";

import { createToolCallLimitHook, ToolCallLimitExceededError } from "./tool.call.limit.js";

describe("createToolCallLimitHook", () => {
    it("상한과 같은 수까지 도구 호출을 허용한다", async () => {
        const controller = new AbortController();
        const hook = createToolCallLimitHook(2, controller);

        expect(await hook()).toEqual({ continue: true });
        expect(await hook()).toEqual({ continue: true });
        expect(controller.signal.aborted).toBe(false);
    });

    it("상한을 넘긴 호출을 도구 호출 상한 오류로 중단한다", async () => {
        const controller = new AbortController();
        const hook = createToolCallLimitHook(1, controller);

        await hook();
        const overLimit = await hook();

        expect(overLimit).toEqual({ continue: false, stopReason: "tool call limit exceeded" });
        expect(controller.signal.aborted).toBe(true);
        expect(controller.signal.reason).toBeInstanceOf(ToolCallLimitExceededError);
    });

    it("훅마다 계수기를 새로 시작한다", async () => {
        const controller = new AbortController();
        const first = createToolCallLimitHook(1, controller);
        await first();

        const second = createToolCallLimitHook(1, new AbortController());
        expect(await second()).toEqual({ continue: true });
    });
});
