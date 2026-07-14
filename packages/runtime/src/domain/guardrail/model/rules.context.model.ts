import {
    RULE_EXPECTATION_KIND,
    RULE_SEVERITY,
    type RuleExpectation,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {VERDICT_STATUS} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
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

const PREAMBLE: readonly string[] = [
    "These rules were derived from what the user asked you in this task. Each one names an action you are expected to actually perform.",
    "Fulfilment is judged from the tool calls recorded after the user's request. Stating that you did something is not evidence; the tool call is.",
    "A warn or block rule left unfulfilled will stop you from ending the turn.",
];

const CLOSING = "Fulfil these before you finish. Answer the user in the language they wrote in; these rules are internal notes to you, not something to relay.";

/** 지난 요구에서 이행되지 않은 판정은 죽지 않고 다음 요구로 이월되어 다시 알려진다. */
function describeJudgment(rule: GuardrailRule): string {
    if (rule.verdictStatus === VERDICT_STATUS.satisfied) return "already fulfilled";
    if (rule.escalated) return "STILL UNFULFILLED after repeated reminders — decide and tell the user why";
    if (rule.verdictStatus === VERDICT_STATUS.unknown) {
        return "could NOT be verified — if you already did it, ignore this; if not, do it now";
    }
    if (rule.verdictStatus === VERDICT_STATUS.open) return "carried over from an earlier request, still unfulfilled";
    return "not yet fulfilled";
}

/** 발효 중인 규칙을 턴이 시작되기 전에 에이전트에게 알리는 컨텍스트다. */
export function formatRulesContext(rules: readonly GuardrailRule[]): string {
    if (rules.length === 0) return "";
    const lines = ["<agent-tracer-rules>", ...PREAMBLE, ""];
    for (const rule of selectAnnouncedRules(rules)) {
        const detail = describeExpectation(rule.expectation);
        lines.push(`- [${rule.severity}] ${rule.name} — ${detail} (${describeJudgment(rule)})`);
    }
    lines.push("", CLOSING, "</agent-tracer-rules>");
    return lines.join("\n");
}

/** 제어 화면이 규칙 행에 쓰는 기대 요약이다. */
export function describeRuleExpectation(rule: GuardrailRule): string {
    return describeExpectation(rule.expectation);
}

function describeExpectation(expectation: RuleExpectation): string {
    switch (expectation.kind) {
        case RULE_EXPECTATION_KIND.command:
            return `must run: ${expectation.commandMatches.join(" or ")}`;
        case RULE_EXPECTATION_KIND.pattern:
            return `must match: ${expectation.pattern}`;
        case RULE_EXPECTATION_KIND.action:
            return `must use: ${expectation.tool}`;
    }
}
