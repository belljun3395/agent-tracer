import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import {selectBlockingVerdicts} from "~runtime/domain/guardrail/model/enforce.model.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";
import {evaluateTurnAgainstRules, type GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";
import type {RuleSourcePort} from "~runtime/domain/guardrail/port/rule.source.port.js";

/** 판정 전체와 그중 턴을 붙잡아야 하는 것을 함께 낸다. */
export interface TurnGuardrailResult {
    readonly verdicts: readonly GuardrailVerdict[];
    readonly blocking: readonly GuardrailVerdict[];
}

/** 턴이 끝나기 전에 규칙 이행 여부를 판정하고, 막은 것은 알렸다고 서버에 남긴다. */
export class EvaluateTurnUsecase {
    constructor(private readonly rules: RuleSourcePort) {}

    execute(
        events: readonly RecentEvent[],
        rules: readonly GuardrailRule[],
        taskId: string,
        context: TurnContext = {},
    ): TurnGuardrailResult {
        const verdicts = evaluateTurnAgainstRules(events, rules, taskId, context);
        const blocking = selectBlockingVerdicts(verdicts);
        for (const verdict of blocking) {
            void this.rules.recordNudge(verdict.ruleId).catch(() => undefined);
        }
        return {verdicts, blocking};
    }
}
