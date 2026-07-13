import {expectationTool} from "@monitor/kernel/rule/definition/rule.expectation.js";
import {
    isAnchoredRule,
    isPreToolDenyingSeverity,
    type ToolCall,
} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {forbiddenNeedleHit} from "@monitor/kernel/rule/evaluation/rule.expectation.condition.js";
import {normalizeRuleExpectedAction} from "@monitor/kernel/rule/evaluation/rule.tool-alias.const.js";
import {findTriggerPhrase} from "@monitor/kernel/rule/evaluation/rule.trigger.match.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {sliceCurrentTurn, type TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";

/** 도구 호출을 사전 거부한 규칙과 걸린 금지 패턴이다. */
export interface PreToolDenial {
    readonly ruleName: string;
    readonly needle: string;
}

export function evaluatePreToolCall(
    events: readonly RecentEvent[],
    rules: readonly GuardrailRule[],
    taskId: string,
    call: ToolCall,
    context: TurnContext = {},
): PreToolDenial | null {
    const turn = sliceCurrentTurn(events, context);
    for (const rule of rules) {
        if (!isPreToolDenyingSeverity(rule.severity)) continue;
        if (!isEnforceableRule(rule, taskId)) continue;
        const forbidden = rule.expectation.forbiddenMatches;
        if (forbidden === undefined || forbidden.length === 0) continue;

        const trigger = !isAnchoredRule(rule) && rule.trigger.phrases.length > 0 ? rule.trigger : null;
        if (trigger !== null) {
            if (turn === null) continue;
            const candidates = [
                {speaker: "user" as const, text: turn.askedText},
                {speaker: "assistant" as const, text: turn.assistantText},
            ];
            if (findTriggerPhrase(trigger, candidates, true) === null) continue;
        }

        const expectedTool = expectationTool(rule.expectation);
        if (expectedTool !== undefined && normalizeRuleExpectedAction(call.tool) !== expectedTool) continue;

        const needle = forbiddenNeedleHit(call, forbidden);
        if (needle !== null) return {ruleName: rule.name, needle};
    }
    return null;
}
