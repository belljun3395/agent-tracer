import {isAnchoredRule, type ToolCall} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import {inferToolCall, sliceFromAnchor} from "@monitor/kernel/rule/evaluation/rule.evaluation.context.js";
import {evaluateExpectation} from "@monitor/kernel/rule/evaluation/rule.expectation.evaluate.js";
import {findTriggerPhrase} from "@monitor/kernel/rule/evaluation/rule.trigger.match.js";
import type {VerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {
    sliceCurrentTurn,
    type CurrentTurn,
    type TurnContext,
} from "~runtime/domain/guardrail/model/turn.window.model.js";

/** 한 규칙을 현재 판정 창에 적용한 결과다. */
export interface GuardrailVerdict {
    readonly ruleName: string;
    readonly severity: string;
    readonly status: VerdictStatus;
    readonly expectedPattern?: string;
    /** 위반한 금지 패턴이다. */
    readonly forbiddenPattern?: string;
    readonly matchedPhrase?: string;
    readonly actualToolCallCount: number;
}

export function evaluateTurnAgainstRules(
    events: readonly RecentEvent[],
    rules: readonly GuardrailRule[],
    taskId: string,
    context: TurnContext = {},
): GuardrailVerdict[] {
    const turn = sliceCurrentTurn(events, context);
    if (turn === null) return [];
    const applicable = rules.filter((rule) => isEnforceableRule(rule, taskId));
    if (applicable.length === 0) return [];

    const candidates = [
        {speaker: "user" as const, text: turn.askedText},
        {speaker: "assistant" as const, text: turn.assistantText},
    ];

    const verdicts: GuardrailVerdict[] = [];
    for (const rule of applicable) {
        const window = ruleWindow(events, turn, rule);
        if (window === null) continue;

        const trigger = !isAnchoredRule(rule) && rule.trigger.phrases.length > 0 ? rule.trigger : null;
        const matchedPhrase = trigger !== null ? findTriggerPhrase(trigger, candidates, true) : null;
        if (trigger !== null && matchedPhrase === null) continue;

        const toolCalls = window
            .map((event) => inferToolCall(event))
            .filter((call): call is ToolCall => call !== null);
        const outcome = evaluateExpectation(rule.expectation, toolCalls);
        verdicts.push({
            ruleName: rule.name,
            severity: rule.severity,
            status: outcome.status,
            ...(outcome.expectedPattern !== undefined ? {expectedPattern: outcome.expectedPattern} : {}),
            ...(outcome.forbiddenPattern !== undefined ? {forbiddenPattern: outcome.forbiddenPattern} : {}),
            ...(matchedPhrase !== null ? {matchedPhrase} : {}),
            actualToolCallCount: outcome.actualToolCalls.length,
        });
    }
    return verdicts;
}

function ruleWindow(
    events: readonly RecentEvent[],
    turn: CurrentTurn,
    rule: GuardrailRule,
): readonly RecentEvent[] | null {
    if (!isAnchoredRule(rule)) return turn.turnEvents;
    const identified = events.filter((event): event is RecentEvent & {id: string} => event.id !== undefined);
    return sliceFromAnchor(identified, rule.anchorEventId ?? "");
}
