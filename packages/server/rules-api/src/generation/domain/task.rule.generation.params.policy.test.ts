import { describe, expect, it } from "vitest";
import {
    clampMaxRules,
    normalizeRuleSuggestionLanguage,
} from "./task.rule.generation.params.policy.js";

describe("clampMaxRules — 최대 규칙 수 보정", () => {
    it("값이 없거나 유효하지 않으면 기본값 5를 쓴다", () => {
        expect(clampMaxRules(null)).toBe(5);
        expect(clampMaxRules("0")).toBe(5);
        expect(clampMaxRules("nope")).toBe(5);
    });

    it("하드캡 20을 넘으면 20으로 자른다", () => {
        expect(clampMaxRules("99")).toBe(20);
    });

    it("범위 안의 값은 그대로 쓴다", () => {
        expect(clampMaxRules("8")).toBe(8);
    });
});

describe("normalizeRuleSuggestionLanguage — 출력 언어 정규화", () => {
    it("지원 언어는 소문자로 정규화한다", () => {
        expect(normalizeRuleSuggestionLanguage("EN")).toBe("en");
    });

    it("미지원/빈 값은 auto로 떨어진다", () => {
        expect(normalizeRuleSuggestionLanguage("de")).toBe("auto");
        expect(normalizeRuleSuggestionLanguage(null)).toBe("auto");
    });
});
