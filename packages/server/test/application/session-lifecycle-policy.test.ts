import { describe, expect, it } from "vitest";
import { shouldAutoCompletePrimary, shouldMovePrimaryToWaiting } from "../../src/application/services/session-lifecycle-policy.js";
describe("SessionLifecyclePolicy", () => {
    it("background 자식이 남아 있으면 primary assistant turn을 자동 완료하지 않는다", () => {
        expect(shouldAutoCompletePrimary({
            taskKind: "primary",
            completeTask: true,
            runningSessionCount: 0,
            completionReason: "assistant_turn_complete",
            hasRunningBackgroundDescendants: true
        })).toBe(false);
    });
    it("idle 종료는 primary 작업을 waiting으로 보낸다", () => {
        expect(shouldMovePrimaryToWaiting({
            taskKind: "primary",
            completeTask: false,
            runningSessionCount: 0,
            completionReason: "idle",
            hasRunningBackgroundDescendants: false
        })).toBe(true);
    });
    it("assistant turn이 끝나도 background 자식이 남아 있으면 primary를 waiting으로 남긴다", () => {
        expect(shouldMovePrimaryToWaiting({
            taskKind: "primary",
            completeTask: true,
            runningSessionCount: 0,
            completionReason: "assistant_turn_complete",
            hasRunningBackgroundDescendants: true
        })).toBe(true);
    });
    it("명시적 종료는 waiting으로 우회하지 않는다", () => {
        expect(shouldMovePrimaryToWaiting({
            taskKind: "primary",
            completeTask: true,
            runningSessionCount: 0,
            completionReason: "explicit_exit",
            hasRunningBackgroundDescendants: true
        })).toBe(false);
    });
});
