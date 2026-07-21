import {RULE_GENERATION_FOCUS} from "@monitor/kernel/job/job.const.js";
import {describe, expect, it} from "vitest";
import {
    defaultMaxRules,
    resolveRulegenMode,
    RULEGEN_MODE,
} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";

describe("resolveRulegenMode", () => {
    it("recent focus는 자동 트리거 모드다", () => {
        expect(resolveRulegenMode(RULE_GENERATION_FOCUS.recent)).toBe(RULEGEN_MODE.recent);
    });

    it("focus가 없으면 수동 생성 모드다", () => {
        expect(resolveRulegenMode(undefined)).toBe(RULEGEN_MODE.manual);
    });
});

describe("defaultMaxRules", () => {
    it("자동 트리거는 2개, 수동 생성은 5개를 기본 상한으로 쓴다", () => {
        expect(defaultMaxRules(RULEGEN_MODE.recent)).toBe(2);
        expect(defaultMaxRules(RULEGEN_MODE.manual)).toBe(5);
    });
});
