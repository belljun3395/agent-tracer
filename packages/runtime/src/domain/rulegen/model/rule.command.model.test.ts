import {KIND} from "@monitor/kernel/ingest/event.kind.const.js";
import {describe, expect, it} from "vitest";
import {
    RULE_GENERATION_MAX_RULES,
    isRuleGenerationTrigger,
    parseMaxRulesPerTask,
    readRuleRequest,
} from "~runtime/domain/rulegen/model/rule.command.model.js";

describe("parseMaxRulesPerTask", () => {
    it("설정이 없거나 정수가 아니면 기본값을 쓴다", () => {
        expect(parseMaxRulesPerTask(undefined)).toBe(RULE_GENERATION_MAX_RULES);
        expect(parseMaxRulesPerTask("many")).toBe(RULE_GENERATION_MAX_RULES);
        expect(parseMaxRulesPerTask("0")).toBe(RULE_GENERATION_MAX_RULES);
    });

    it("잡 입력 스키마의 상한을 넘는 값은 상한으로 자른다", () => {
        expect(parseMaxRulesPerTask("100")).toBe(20);
    });
});

describe("readRuleRequest", () => {
    it("명령 접두사를 벗기고 요구만 남긴다", () => {
        expect(readRuleRequest("/rule 규칙을 뽑아줘")).toBe("규칙을 뽑아줘");
        expect(readRuleRequest("/agent-tracer-monitor:rule 확인해줘")).toBe("확인해줘");
        expect(readRuleRequest("$rule 이번 턴")).toBe("이번 턴");
    });

    it("규칙 명령이 아니거나 요구가 없으면 빈 문자열을 낸다", () => {
        expect(readRuleRequest("규칙을 만들어줘")).toBe("");
        expect(readRuleRequest("/ruleset")).toBe("");
        expect(readRuleRequest("/rule")).toBe("");
    });
});

describe("isRuleGenerationTrigger", () => {
    it("요구가 담긴 사용자 입력의 규칙 명령만 자격을 준다", () => {
        expect(isRuleGenerationTrigger(KIND.userMessage, "t1", "e1", "/rule 테스트 돌려줘")).toBe(true);
        expect(isRuleGenerationTrigger(KIND.userMessage, "t1", "e1", "/rule")).toBe(false);
    });

    it("이벤트 종류나 식별자가 없으면 자격을 뺏는다", () => {
        expect(isRuleGenerationTrigger(KIND.assistantResponse, "t1", "e1", "/rule 테스트")).toBe(false);
        expect(isRuleGenerationTrigger(KIND.userMessage, "t1", "", "/rule 테스트")).toBe(false);
        expect(isRuleGenerationTrigger(KIND.userMessage, "", "e1", "/rule 테스트")).toBe(false);
    });
});
