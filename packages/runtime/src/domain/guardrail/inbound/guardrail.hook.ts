import type {
    EvaluateTurnUsecase,
    TurnGuardrailResult,
} from "~runtime/domain/guardrail/application/evaluate.turn.usecase.js";
import type {RefreshRulesUsecase} from "~runtime/domain/guardrail/application/refresh.rules.usecase.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

/** 가드레일 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface GuardrailHook {
    readonly evaluateTurn: EvaluateTurnUsecase;
    readonly refreshRules: RefreshRulesUsecase;
}

export function onTurnStop(
    hook: GuardrailHook,
    events: readonly RecentEvent[],
    rules: readonly GuardrailRule[],
    taskId: string,
    context: TurnContext = {},
): TurnGuardrailResult {
    return hook.evaluateTurn.execute(events, rules, taskId, context);
}

export function onRulesRefresh(hook: GuardrailHook): Promise<readonly GuardrailRule[] | null> {
    return hook.refreshRules.execute();
}
