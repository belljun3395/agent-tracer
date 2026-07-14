import { describe, expect, it } from "vitest";
import {
    commandIncludesAny,
    compilePattern,
} from "./rule.pattern.js";
import { RULE_SEVERITY, RULE_SOURCE } from "../definition/rule.vocabulary.js";
import { aggregateVerdictStatus, VERDICT_STATUS, type VerdictStatus } from "./rule.verdict.js";

describe("RULE_SOURCE", () => {
    it("규칙 출처 어휘를 고정한다", () => {
        expect(RULE_SOURCE.human).toBe("human");
        expect(RULE_SOURCE.agent).toBe("agent");
    });
});

describe("commandIncludesAny", () => {
    it("대소문자 구분 없이 needle 중 하나라도 포함하면 true를 반환한다", () => {
        expect(commandIncludesAny("npm run TEST", ["test"])).toBe(true);
    });

    it("아무 needle도 포함하지 않으면 false를 반환한다", () => {
        expect(commandIncludesAny("npm run build", ["test", "lint"])).toBe(false);
    });
});

describe("compilePattern", () => {
    it("유효한 정규식 문자열을 컴파일한다", () => {
        const re = compilePattern("^foo.*bar$");
        expect(re).not.toBeNull();
        expect(re!.test("foo123bar")).toBe(true);
    });

    it("잘못된 정규식은 null을 반환한다", () => {
        expect(compilePattern("(unterminated")).toBeNull();
    });
});

describe("aggregateVerdictStatus", () => {
    const halting = (status: VerdictStatus) => ({ status, severity: RULE_SEVERITY.block });
    const recordOnly = (status: VerdictStatus) => ({ status, severity: RULE_SEVERITY.info });

    it("빈 배열이면 null을 반환한다", () => {
        expect(aggregateVerdictStatus([])).toBeNull();
    });

    it("턴을 붙잡는 규칙 중 가장 나쁜 상태가 턴을 대표한다", () => {
        expect(aggregateVerdictStatus([halting(VERDICT_STATUS.satisfied), halting(VERDICT_STATUS.unmet)]))
            .toBe(VERDICT_STATUS.unmet);
        expect(aggregateVerdictStatus([halting(VERDICT_STATUS.satisfied), halting(VERDICT_STATUS.unknown)]))
            .toBe(VERDICT_STATUS.unknown);
    });

    it("기록만 하는 규칙의 미이행은 턴의 결론을 바꾸지 않는다", () => {
        expect(aggregateVerdictStatus([halting(VERDICT_STATUS.satisfied), recordOnly(VERDICT_STATUS.unmet)]))
            .toBe(VERDICT_STATUS.satisfied);
    });

    it("턴을 붙잡는 규칙이 하나도 없으면 대표할 것이 없다", () => {
        expect(aggregateVerdictStatus([recordOnly(VERDICT_STATUS.unmet)])).toBeNull();
    });
});
