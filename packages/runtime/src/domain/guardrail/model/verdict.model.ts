import {observe, type Observation} from "@monitor/kernel/rule/evaluation/rule.observation.js";
import {judge} from "@monitor/kernel/rule/evaluation/rule.judgment.js";
import {sliceFromAnchor} from "@monitor/kernel/rule/evaluation/rule.evaluation.context.js";
import type {VerdictStatus} from "@monitor/kernel/rule/evaluation/rule.verdict.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import {isEnforceableRule, type GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {sliceCurrentTurn, type TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";

/** 한 규칙을 현재 판정 창에 적용한 결과다. */
export interface GuardrailVerdict {
    readonly ruleId: string;
    readonly ruleName: string;
    readonly severity: string;
    readonly status: VerdictStatus;
    readonly escalated: boolean;
    readonly expectedPattern?: string;
    readonly actualToolCallCount: number;
    /** 도구 호출인데 분류하지 못한 이벤트 수이며 있으면 미이행이라 단언할 수 없다. */
    readonly unclassifiedCount: number;
}

interface RuleWindow {
    readonly observations: readonly Observation[];
    readonly covered: boolean;
}

export function evaluateTurnAgainstRules(
    events: readonly RecentEvent[],
    rules: readonly GuardrailRule[],
    taskId: string,
    context: TurnContext = {},
): GuardrailVerdict[] {
    if (sliceCurrentTurn(events, context) === null) return [];

    const verdicts: GuardrailVerdict[] = [];
    for (const rule of rules.filter((candidate) => isEnforceableRule(candidate, taskId))) {
        const window = ruleWindow(events, rule);
        const judgment = judge(rule.expectation, window);
        verdicts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            status: judgment.status,
            escalated: rule.escalated,
            ...(judgment.expectedPattern !== undefined ? {expectedPattern: judgment.expectedPattern} : {}),
            actualToolCallCount: judgment.actualToolCalls.length,
            unclassifiedCount: judgment.unclassifiedEventIds.length,
        });
    }
    return verdicts;
}

/** 근거 입력이 버퍼 밖으로 밀려나면 규칙보다 앞선 호출을 증거로 잘못 세므로 아무것도 보지 않는다. */
function ruleWindow(events: readonly RecentEvent[], rule: GuardrailRule): RuleWindow {
    const identified = events.filter((event): event is RecentEvent & {id: string} => event.id !== undefined);
    const sliced = sliceFromAnchor(identified, rule.anchorEventId);
    if (sliced === null) return {observations: [], covered: false};
    const observations = sliced
        .map((event) => observe(event))
        .filter((observation): observation is Observation => observation !== null);
    return {observations, covered: true};
}
