import type {ToolCall} from "@monitor/kernel/rule/definition/rule.vocabulary.js";
import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import {evaluatePreToolCall, type PreToolDenial} from "~runtime/domain/guardrail/model/pre-tool.model.js";
import type {TurnContext} from "~runtime/domain/guardrail/model/turn.window.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";

/** 도구가 실행되기 전에 금지 조항에 걸리는지 본다. */
export class EvaluatePreToolUsecase {
    execute(
        events: readonly RecentEvent[],
        rules: readonly GuardrailRule[],
        taskId: string,
        call: ToolCall,
        context: TurnContext = {},
    ): PreToolDenial | null {
        return evaluatePreToolCall(events, rules, taskId, call, context);
    }
}
