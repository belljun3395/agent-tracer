import {KIND} from "@monitor/kernel/ingest/event.kind.const.js";
import {describe, expect, it} from "vitest";
import {
    AUTO_RULE_GENERATION_MAX_RULES,
    hasRuleCommand,
    isAutoRuleGenerationTrigger,
    parseMaxRulesPerTask,
    type AutoRuleGenerationSetting,
} from "~runtime/domain/rulegen/model/auto.trigger.model.js";

const ENABLED: AutoRuleGenerationSetting = {enabled: true, maxRulesPerTask: 2};

describe("parseMaxRulesPerTask", () => {
    it("설정이 없거나 정수가 아니면 기본값을 쓴다", () => {
        expect(parseMaxRulesPerTask(undefined)).toBe(AUTO_RULE_GENERATION_MAX_RULES);
        expect(parseMaxRulesPerTask("many")).toBe(AUTO_RULE_GENERATION_MAX_RULES);
        expect(parseMaxRulesPerTask("0")).toBe(AUTO_RULE_GENERATION_MAX_RULES);
    });

    it("잡 입력 스키마의 상한을 넘는 값은 상한으로 자른다", () => {
        expect(parseMaxRulesPerTask("100")).toBe(20);
    });
});

describe("hasRuleCommand", () => {
    it("슬래시 명령과 네임스페이스가 붙은 호출을 규칙 명령으로 본다", () => {
        expect(hasRuleCommand("/rule 규칙을 뽑아줘")).toBe(true);
        expect(hasRuleCommand("/agent-tracer-monitor:rule 확인해줘")).toBe(true);
        expect(hasRuleCommand("$rule 이번 턴")).toBe(true);
    });

    it("규칙 명령이 아닌 입력은 거른다", () => {
        expect(hasRuleCommand("규칙을 만들어줘")).toBe(false);
        expect(hasRuleCommand("/ruleset")).toBe(false);
    });
});

describe("isAutoRuleGenerationTrigger", () => {
    it("토글이 켜진 사용자 입력의 규칙 명령만 자격을 준다", () => {
        expect(isAutoRuleGenerationTrigger(ENABLED, KIND.userMessage, "t1", "e1", "/rule")).toBe(true);
    });

    it("토글이 꺼졌거나 이벤트 종류나 식별자가 없으면 자격을 뺏는다", () => {
        expect(isAutoRuleGenerationTrigger({enabled: false, maxRulesPerTask: 2}, KIND.userMessage, "t1", "e1", "/rule"))
            .toBe(false);
        expect(isAutoRuleGenerationTrigger(ENABLED, KIND.assistantResponse, "t1", "e1", "/rule")).toBe(false);
        expect(isAutoRuleGenerationTrigger(ENABLED, KIND.userMessage, "t1", "", "/rule")).toBe(false);
    });
});
