import {afterEach, describe, expect, it, vi} from "vitest";
import {resolveTimeoutSignal} from "~runtime/config/http.js";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("resolveTimeoutSignal", () => {
    it("signal이 없으면 주어진 타임아웃으로 새 signal을 만든다", () => {
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

        resolveTimeoutSignal(10_000);

        expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    });

    it("signal이 있으면 그대로 돌려주고 타임아웃 signal을 만들지 않는다", () => {
        const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
        const controller = new AbortController();

        const resolved = resolveTimeoutSignal(10_000, controller.signal);

        expect(resolved).toBe(controller.signal);
        expect(timeoutSpy).not.toHaveBeenCalled();
    });
});
