import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import { isCommandExpectedAction } from "@monitor/rules-api/rule/public/predicates.js";
import { VERDICT_STATUS } from "./const/verdict.const.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.js";
import { matchRuleTrigger, type TriggerMatch } from "./rule.trigger.matching.js";
import type { TurnVerdict, VerdictStatus } from "./model/verdict.model.js";

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

interface ExpectationEvaluation {
    readonly status: VerdictStatus;
    readonly actualToolCalls: string[];
    readonly expectedPattern?: string;
    readonly matchedToolCalls?: string[];
}

function compilePattern(pattern: string): RegExp | null {
    try {
        return new RegExp(pattern);
    } catch {
        return null;
    }
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
        // 기대한 명령 계열 도구가 없으면 요구 행동이 충족되지 않은 것이다.
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
        // 패턴이 컴파일되지 않으면 룰 자체가 판정 불가능하다.
        return {
            status: VERDICT_STATUS.unverifiable,
            actualToolCalls,
            expectedPattern: pattern,
        };
    }
    if (matchingToolCalls.length === 0) {
        // 검사할 도구 호출이 없으면 기대한 증거가 없는 것으로 본다.
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
        // 기대 조건이 비어 있으면 verified/contradicted를 결정할 기준이 없다.
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
        // commandMatches는 정규식이 아니라 실제 명령에 포함될 리터럴 문자열이다.
        return evaluateCommandMatchesExpectation(commandMatches, matchingToolCalls);
    }
    if (pattern !== undefined) {
        // pattern 룰은 기대 액션에 맞는 도구 호출의 파일 경로나 명령 문자열을 대상으로 판정한다.
        return evaluatePatternExpectation(pattern, matchingToolCalls);
    }
    // action만 있는 룰은 해당 액션 도구 호출의 존재 여부로 충족 여부를 판단한다.
    return evaluateActionExpectation(action, matchingToolCalls);
}

function evaluateRule(
    rule: Rule,
    input: EvaluateTurnInput,
): TurnVerdict | null {
    let matchedPhrase: string | undefined;
    if (rule.trigger !== undefined) {
        // 트리거가 있는 룰은 해당 문구가 실제 턴에 나타난 경우에만 평가한다.
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
        id: input.newVerdictId(),
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
    // turn 평가는 부정 표현 뒤의 문구를 트리거에서 제외한다(negationAware).
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
