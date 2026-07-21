import {afterEach, describe, expect, it, vi} from "vitest";
import {
    createDeadline,
    isRulegenCanceled,
    RulegenCanceled,
    RulegenDeadlineExceeded,
} from "~runtime/domain/rulegen/model/deadline.model.js";

describe("isRulegenCanceled", () => {
    it("취소는 데몬의 손을 떠난 신호이고 데드라인 초과는 아니다", () => {
        expect(isRulegenCanceled(new RulegenCanceled("canceled"))).toBe(true);
        expect(isRulegenCanceled(new RulegenDeadlineExceeded("timed out"))).toBe(false);
        expect(isRulegenCanceled(new Error("other"))).toBe(false);
    });
});

describe("createDeadline", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("제한 시간을 넘기면 데드라인 초과로 중단한다", () => {
        vi.useFakeTimers();
        const deadline = createDeadline(1_000);

        expect(deadline.controller.signal.aborted).toBe(false);
        vi.advanceTimersByTime(1_000);

        expect(deadline.controller.signal.aborted).toBe(true);
        expect(deadline.controller.signal.reason).toBeInstanceOf(RulegenDeadlineExceeded);
    });

    it("dispose하면 타이머를 걷어 더는 중단하지 않는다", () => {
        vi.useFakeTimers();
        const deadline = createDeadline(1_000);

        deadline.dispose();
        vi.advanceTimersByTime(5_000);

        expect(deadline.controller.signal.aborted).toBe(false);
    });

    it("취소 신호가 이미 서 있으면 곧바로 취소로 중단한다", () => {
        const cancel = new AbortController();
        cancel.abort();

        const deadline = createDeadline(1_000, cancel.signal);

        expect(deadline.controller.signal.aborted).toBe(true);
        expect(deadline.controller.signal.reason).toBeInstanceOf(RulegenCanceled);
    });

    it("나중에 취소 신호가 서면 취소로 중단한다", () => {
        const cancel = new AbortController();
        const deadline = createDeadline(1_000, cancel.signal);

        cancel.abort();

        expect(deadline.controller.signal.aborted).toBe(true);
        expect(deadline.controller.signal.reason).toBeInstanceOf(RulegenCanceled);
    });
});
