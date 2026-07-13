import { describe, expect, it } from "vitest";
import {
    commandIncludesAny,
    compilePattern,
} from "./rule.pattern.js";
import { findTriggerPhrase } from "./rule.trigger.match.js";
import { RULE_SOURCE, type RuleTrigger } from "../definition/rule.vocabulary.js";
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

describe("findTriggerPhrase", () => {
    const trigger: RuleTrigger = { phrases: ["deploy to prod"], on: "user" };

    it("트리거가 null이면 null을 반환한다", () => {
        expect(findTriggerPhrase(null, [], false)).toBeNull();
    });

    it("허용된 화자의 텍스트에서 문구를 찾으면 그 문구를 반환한다", () => {
        const result = findTriggerPhrase(trigger, [{ speaker: "user", text: "please deploy to prod now" }], false);
        expect(result).toBe("deploy to prod");
    });

    it("on으로 허용되지 않은 화자의 텍스트는 무시한다", () => {
        const result = findTriggerPhrase(trigger, [{ speaker: "assistant", text: "deploy to prod" }], false);
        expect(result).toBeNull();
    });

    it("on이 없으면 사용자와 어시스턴트 발화만 대조한다", () => {
        const anySpeakerTrigger: RuleTrigger = { phrases: ["deploy to prod"] };
        expect(findTriggerPhrase(anySpeakerTrigger, [{ speaker: "other", text: "deploy to prod" }], false)).toBeNull();
        expect(findTriggerPhrase(anySpeakerTrigger, [{ speaker: "assistant", text: "deploy to prod" }], false)).toBe("deploy to prod");
    });

    it("negationAware가 true이고 부정어가 바로 앞에 있으면 무시한다", () => {
        const result = findTriggerPhrase(trigger, [{ speaker: "user", text: "did not deploy to prod" }], true);
        expect(result).toBeNull();
    });

    it("negationAware가 false면 부정어가 있어도 문구를 찾는다", () => {
        const result = findTriggerPhrase(trigger, [{ speaker: "user", text: "did not deploy to prod" }], false);
        expect(result).toBe("deploy to prod");
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
