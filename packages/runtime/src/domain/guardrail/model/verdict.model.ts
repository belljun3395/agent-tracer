import type {ToolCall} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {inferToolCall, sliceFromAnchor} from "@monitor/kernel/rule/evaluation/rule.evaluation.context.js";
import {evaluateExpectation} from "@monitor/kernel/rule/evaluation/rule.expectation.evaluate.js";
import type {VerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {sliceCurrentTurn, type TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";

/** 한 규칙을 현재 판정 창에 적용한 결과다. */
export interface GuardrailVerdict {
    readonly ruleName: string;
    readonly severity: string;
    readonly status: VerdictStatus;
    readonly expectedPattern?: string;
    readonly actualToolCallCount: number;
}

export function evaluateTurnAgainstRules(
    events: readonly RecentEvent[],
    rules: readonly GuardrailRule[],
    taskId: string,
    context: TurnContext = {},
): GuardrailVerdict[] {
    if (sliceCurrentTurn(events, context) === null) return [];
    const applicable = rules.filter((rule) => isEnforceableRule(rule, taskId));
    if (applicable.length === 0) return [];

    const verdicts: GuardrailVerdict[] = [];
    for (const rule of applicable) {
        const window = ruleWindow(events, rule);
        if (window === null) continue;

        const toolCalls = window
            .map((event) => inferToolCall(event))
            .filter((call): call is ToolCall => call !== null);
        const outcome = evaluateExpectation(rule.expectation, toolCalls);
        verdicts.push({
            ruleName: rule.name,
            severity: rule.severity,
            status: outcome.status,
            ...(outcome.expectedPattern !== undefined ? {expectedPattern: outcome.expectedPattern} : {}),
            actualToolCallCount: outcome.actualToolCalls.length,
        });
    }
    return verdicts;
}

function ruleWindow(events: readonly RecentEvent[], rule: GuardrailRule): readonly RecentEvent[] | null {
    const identified = events.filter((event): event is RecentEvent & {id: string} => event.id !== undefined);
    return sliceFromAnchor(identified, rule.anchorEventId);
}
