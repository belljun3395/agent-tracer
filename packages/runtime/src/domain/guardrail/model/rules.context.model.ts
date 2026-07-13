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
        "이 작업에 발효 중인 규칙이다. block 규칙을 어기면 도구 호출이 거부되거나 턴이 차단된다.",
    ];
    for (const rule of selectAnnouncedRules(rules)) {
        const detail = describeExpectation(rule.expectation);
        lines.push(`• [${rule.severity}] ${rule.name} (${describeTrigger(rule)})${detail ? `: ${detail}` : ""}`);
    }
    lines.push("</agent-tracer-rules>");
    return lines.join("\n");
}

/** 제어 화면이 규칙 행에 쓰는 트리거 요약이다. */
export function describeTriggerPhrases(trigger: GuardrailRule["trigger"]): string {
    const phrases = trigger.phrases.filter((phrase) => phrase.trim().length > 0);
    if (phrases.length === 0) return "always";
    const joined = phrases.join(", ");
    return trigger.on !== undefined ? `${trigger.on}: ${joined}` : joined;
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
        case RULE_EXPECTATION_KIND.forbidden:
            break;
    }
    const forbidden = expectation.forbiddenMatches ?? [];
    if (forbidden.length > 0) clauses.push(`금지: ${forbidden.join(", ")}`);
    return clauses.join(" / ");
}

function describeTrigger(rule: GuardrailRule): string {
    const phrases = rule.trigger.phrases.filter((phrase) => phrase.trim().length > 0);
    return phrases.length === 0 ? "항상 적용" : `발화 시: ${phrases.join(", ")}`;
}
