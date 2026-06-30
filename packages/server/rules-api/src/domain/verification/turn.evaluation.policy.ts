import type { Rule } from "@monitor/rules-api/domain/rule/rule.types.js";
import { isCommandExpectedAction } from "@monitor/rules-api/domain/rule/rule.predicates.exports.js";
import { compilePattern } from "@monitor/shared/kernel/compile.pattern.js";
import { VERDICT_STATUS } from "./const/verdict.const.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.policy.js";
import { matchRuleTrigger, type TriggerMatch } from "./rule.trigger.matching.policy.js";
import type { TurnVerdict, VerdictStatus } from "./type/verdict.type.js";

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
}

export interface EvaluateTurnResult {
    readonly verdicts: ReadonlyArray<TurnVerdict>;
}

interface ExpectationEvaluation {
    readonly status: VerdictStatus;
    readonly actualToolCalls: string[];
    readonly expectedPattern?: string;
    readonly matchedToolCalls?: string[];
}

function commandIncludesAny(cmd: string, needles: readonly string[]): boolean {
    const normalized = cmd.toLowerCase();
    return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

function statusFromMatchedCount(matchedCount: number): VerdictStatus {
    return matchedCount > 0 ? VERDICT_STATUS.verified : VERDICT_STATUS.contradicted;
}

function commandEvidence(toolCall: EvaluateTurnToolCall): string {
    return toolCall.command ?? "";
}

function toolCallEvidence(toolCall: EvaluateTurnToolCall): string {
    return toolCall.filePath ?? toolCall.command ?? "";
}

function evaluateCommandMatchesExpectation(
    commandMatches: readonly string[],
    matchingToolCalls: ReadonlyArray<EvaluateTurnToolCall>,
): ExpectationEvaluation {
    const actualToolCalls = matchingToolCalls.map(commandEvidence);
    const expectedPattern = commandMatches.join(" | ");
    if (matchingToolCalls.length === 0) {
        return {
            status: VERDICT_STATUS.contradicted,
            actualToolCalls,
            expectedPattern,
        };
    }

    const matched = matchingToolCalls.filter((tc) =>
        commandIncludesAny(commandEvidence(tc), commandMatches),
    );
    return {
        status: statusFromMatchedCount(matched.length),
        actualToolCalls,
        expectedPattern,
        ...(matched.length > 0 ? { matchedToolCalls: matched.map(commandEvidence) } : {}),
    };
}

function evaluatePatternExpectation(
    pattern: string,
    matchingToolCalls: ReadonlyArray<EvaluateTurnToolCall>,
): ExpectationEvaluation {
    const actualToolCalls = matchingToolCalls.map(toolCallEvidence);
    const re = compilePattern(pattern);
    if (re === null) {
        return {
            status: VERDICT_STATUS.unverifiable,
            actualToolCalls,
            expectedPattern: pattern,
        };
    }
    if (matchingToolCalls.length === 0) {
        return {
            status: VERDICT_STATUS.contradicted,
            actualToolCalls,
            expectedPattern: pattern,
        };
    }

    const matched = matchingToolCalls.filter((tc) => re.test(toolCallEvidence(tc)));
    return {
        status: statusFromMatchedCount(matched.length),
        actualToolCalls,
        expectedPattern: pattern,
        ...(matched.length > 0 ? { matchedToolCalls: matched.map(toolCallEvidence) } : {}),
    };
}

function evaluateActionExpectation(
    action: Rule["expect"]["action"],
    matchingToolCalls: ReadonlyArray<EvaluateTurnToolCall>,
): ExpectationEvaluation {
    const actualToolCalls = matchingToolCalls.map(toolCallEvidence);
    if (action === undefined) {
        return {
            status: VERDICT_STATUS.unverifiable,
            actualToolCalls,
        };
    }

    return {
        status: statusFromMatchedCount(matchingToolCalls.length),
        actualToolCalls,
        ...(matchingToolCalls.length > 0 ? { matchedToolCalls: actualToolCalls } : {}),
    };
}

function evaluateExpectation(
    expect: Rule["expect"],
    matchingToolCalls: ReadonlyArray<EvaluateTurnToolCall>,
): ExpectationEvaluation {
    const { action, commandMatches, pattern } = expect;
    if ((action === undefined || isCommandExpectedAction(action)) && commandMatches !== undefined) {
        return evaluateCommandMatchesExpectation(commandMatches, matchingToolCalls);
    }
    if (pattern !== undefined) {
        return evaluatePatternExpectation(pattern, matchingToolCalls);
    }
    return evaluateActionExpectation(action, matchingToolCalls);
}

function evaluateRule(
    rule: Rule,
    input: EvaluateTurnInput,
): TurnVerdict | null {
    let matchedPhrase: string | undefined;
    if (rule.trigger !== undefined) {
        const triggerMatch = findRuleTriggerMatch(rule, input);
        if (triggerMatch === null) return null;
        matchedPhrase = triggerMatch.phrase;
    }

    const matchingToolCalls =
        rule.expect.action === undefined
            ? input.toolCalls
            : input.toolCalls.filter((tc) =>
                verificationToolMatchesExpectedAction(tc.tool, rule.expect.action!),
            );

    const expectation = evaluateExpectation(rule.expect, matchingToolCalls);

    const detail: TurnVerdict["detail"] = {
        actualToolCalls: expectation.actualToolCalls,
        ...(matchedPhrase !== undefined ? { matchedPhrase } : {}),
        ...(expectation.expectedPattern !== undefined
            ? { expectedPattern: expectation.expectedPattern }
            : {}),
        ...(expectation.matchedToolCalls !== undefined
            ? { matchedToolCalls: expectation.matchedToolCalls }
            : {}),
    };
    return {
        id: `${input.turnId}:${rule.id}`,
        turnId: input.turnId,
        ruleId: rule.id,
        status: expectation.status,
        detail,
        evaluatedAt: input.now,
    };
}

function findRuleTriggerMatch(
    rule: Rule,
    input: EvaluateTurnInput,
): TriggerMatch | null {
    return matchRuleTrigger(
        rule,
        [
            { speaker: "user", text: input.userMessageText ?? "" },
            { speaker: "assistant", text: input.assistantText },
        ],
        { negationAware: true },
    );
}

export function evaluateTurn(input: EvaluateTurnInput): EvaluateTurnResult {
    const verdicts: TurnVerdict[] = [];
    for (const rule of input.rules) {
        const verdict = evaluateRule(rule, input);
        if (verdict !== null) verdicts.push(verdict);
    }
    return { verdicts };
}
