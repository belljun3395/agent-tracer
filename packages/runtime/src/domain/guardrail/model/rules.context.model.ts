import {
    RULE_EXPECTATION_KIND,
    RULE_SEVERITY,
    type RuleExpectation,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";

const MAX_ANNOUNCED_RULES = 12;

const SEVERITY_RANK: Record<string, number> = {
    [RULE_SEVERITY.block]: 3,
    [RULE_SEVERITY.warn]: 2,
    [RULE_SEVERITY.info]: 1,
};

export function selectAnnouncedRules(rules: readonly GuardrailRule[]): GuardrailRule[] {
    return [...rules]
        .sort((left, right) => (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0))
        .slice(0, MAX_ANNOUNCED_RULES);
}

/** 발효 중인 규칙을 턴이 시작되기 전에 에이전트에게 알리는 컨텍스트다. */
export function formatRulesContext(rules: readonly GuardrailRule[]): string {
    if (rules.length === 0) return "";
    const lines = [
        "<agent-tracer-rules>",
        "이 작업에 발효 중인 규칙이다. 사용자의 요구에서 나왔으며 미이행이면 턴이 차단된다.",
    ];
    for (const rule of selectAnnouncedRules(rules)) {
        const detail = describeExpectation(rule.expectation);
        lines.push(`• [${rule.severity}] ${rule.name}${detail ? `: ${detail}` : ""}`);
    }
    lines.push("</agent-tracer-rules>");
    return lines.join("\n");
}

/** 제어 화면이 규칙 행에 쓰는 기대 요약이다. */
export function describeRuleExpectation(rule: GuardrailRule): string {
    return describeExpectation(rule.expectation);
}

function describeExpectation(expectation: RuleExpectation): string {
    const clauses: string[] = [];
    switch (expectation.kind) {
        case RULE_EXPECTATION_KIND.command:
            clauses.push(`필수 명령: ${expectation.commandMatches.join(", ")}`);
            break;
        case RULE_EXPECTATION_KIND.pattern:
            clauses.push(`필수 패턴: ${expectation.pattern}`);
            break;
        case RULE_EXPECTATION_KIND.action:
            clauses.push(`필수 도구: ${expectation.tool}`);
            break;
    }
    return clauses.join(" / ");
}
