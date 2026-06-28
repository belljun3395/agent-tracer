import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import type { TurnVerdict } from "../type/verdict.type.js";

export interface EvaluateTurnToolCall {
    readonly tool: string;
    readonly command?: string;
    readonly filePath?: string;
}

export interface EvaluateTurnInput {
    readonly turnId: string;
    readonly assistantText: string;
    readonly userMessageText?: string;
    readonly toolCalls: ReadonlyArray<EvaluateTurnToolCall>;
    readonly rules: ReadonlyArray<Rule>;
    readonly now: string;
    readonly newVerdictId: () => string;
}

export interface EvaluateTurnResult {
    readonly verdicts: ReadonlyArray<TurnVerdict>;
}
