import { describe, expect, it } from "vitest";
import {
    commandIncludesAny,
    compilePattern,
} from "./rule.pattern.js";
import { RULE_SOURCE } from "../definition/rule.vocabulary.js";
import { aggregateVerdictStatus, VERDICT_STATUS } from "./rule.verdict.js";

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
    it("빈 배열이면 null을 반환한다", () => {
        expect(aggregateVerdictStatus([])).toBeNull();
    });

    it("contradicted가 하나라도 있으면 그것이 우선한다", () => {
        expect(aggregateVerdictStatus([VERDICT_STATUS.verified, VERDICT_STATUS.contradicted])).toBe(VERDICT_STATUS.contradicted);
    });

    it("contradicted가 없고 unverifiable이 있으면 unverifiable이 우선한다", () => {
        expect(aggregateVerdictStatus([VERDICT_STATUS.verified, VERDICT_STATUS.unverifiable])).toBe(VERDICT_STATUS.unverifiable);
    });

    it("전부 verified면 verified를 반환한다", () => {
        expect(aggregateVerdictStatus([VERDICT_STATUS.verified, VERDICT_STATUS.verified])).toBe(VERDICT_STATUS.verified);
    });
});
