import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import { isCommandExpectedAction } from "@monitor/rules-api/rule/public/predicates.js";
import { verificationToolMatchesExpectedAction } from "./tool.action.matching.js";
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

const NEGATION_MARKERS: readonly string[] = [
    "did not ",
    "didn't ",
    "not ",
    "haven't ",
    "have not ",
    "never ",
    "no ",
    "couldn't ",
    "could not ",
];

const NEGATION_LOOKBACK = 20;

function findTriggerMatch(
    text: string,
    phrases: readonly string[],
): { phrase: string; index: number } | null {
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
        const needle = phrase.toLowerCase();
        const idx = lower.indexOf(needle);
        if (idx !== -1) {
            return { phrase, index: idx };
        }
    }
    return null;
}

function isNegated(text: string, matchIndex: number): boolean {
    const start = Math.max(0, matchIndex - NEGATION_LOOKBACK);
    const window = text.slice(start, matchIndex).toLowerCase();
    return NEGATION_MARKERS.some((marker) => window.includes(marker));
}

function compilePattern(pattern: string): RegExp | null {
    try {
        return new RegExp(pattern);
    } catch {
        return null;
    }
}

function compilePatterns(patterns: readonly string[]): RegExp[] | null {
    const compiled: RegExp[] = [];
    for (const p of patterns) {
        const re = compilePattern(p);
        if (re === null) return null;
        compiled.push(re);
    }
    return compiled;
}

function commandMatchesAny(cmd: string, regexps: readonly RegExp[]): boolean {
    return regexps.some((re) => re.test(cmd));
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

    let status: VerdictStatus;
    let expectedPattern: string | undefined;
    let actualToolCalls: string[];
    let matchedToolCalls: string[] | undefined;

    const { action, commandMatches, pattern } = rule.expect;

    if ((action === undefined || isCommandExpectedAction(action)) && commandMatches !== undefined) {
        // commandMatches 룰은 명령 정규식이 유효하고 실행 명령 중 하나라도 맞으면 verified다.
        expectedPattern = commandMatches.join(" | ");
        const regexps = compilePatterns(commandMatches);
        if (regexps === null) {
            // 정규식 자체가 깨진 룰은 실행 결과와 무관하게 검증 불가로 남긴다.
            status = "unverifiable";
            actualToolCalls = matchingToolCalls.map((tc) => tc.command ?? "");
        } else {
            const bashCalls = matchingToolCalls;
            actualToolCalls = bashCalls.map((tc) => tc.command ?? "");
            if (bashCalls.length === 0) {
                // 기대한 명령 계열 도구가 없으면 요구 행동이 충족되지 않은 것이다.
                status = "contradicted";
            } else {
                const matched = bashCalls.filter((tc) =>
                    commandMatchesAny(tc.command ?? "", regexps),
                );
                status = matched.length > 0 ? "verified" : "contradicted";
                if (matched.length > 0) {
                    matchedToolCalls = matched.map((tc) => tc.command ?? "");
                }
            }
        }
    } else if (pattern !== undefined) {
        // pattern 룰은 기대 액션에 맞는 도구 호출의 파일 경로나 명령 문자열을 대상으로 판정한다.
        expectedPattern = pattern;
        const re = compilePattern(pattern);
        actualToolCalls = matchingToolCalls.map(
            (tc) => tc.filePath ?? tc.command ?? "",
        );
        if (re === null) {
            // 패턴이 컴파일되지 않으면 룰 자체가 판정 불가능하다.
            status = "unverifiable";
        } else if (matchingToolCalls.length === 0) {
            // 검사할 도구 호출이 없으면 기대한 증거가 없는 것으로 본다.
            status = "contradicted";
        } else {
            const matched = matchingToolCalls.filter((tc) =>
                re.test(tc.filePath ?? tc.command ?? ""),
            );
            status = matched.length > 0 ? "verified" : "contradicted";
            if (matched.length > 0) {
                matchedToolCalls = matched.map((tc) => tc.filePath ?? tc.command ?? "");
            }
        }
    } else {
        actualToolCalls = matchingToolCalls.map(
            (tc) => tc.filePath ?? tc.command ?? "",
        );
        if (action === undefined) {
            // 기대 조건이 비어 있으면 verified/contradicted를 결정할 기준이 없다.
            status = "unverifiable";
        } else {
            // action만 있는 룰은 해당 액션 도구 호출의 존재 여부로 충족 여부를 판단한다.
            status = matchingToolCalls.length > 0 ? "verified" : "contradicted";
            if (matchingToolCalls.length > 0) {
                matchedToolCalls = actualToolCalls;
            }
        }
    }

    const detail: TurnVerdict["detail"] = {
        actualToolCalls,
        ...(matchedPhrase !== undefined ? { matchedPhrase } : {}),
        ...(expectedPattern !== undefined ? { expectedPattern } : {}),
        ...(matchedToolCalls !== undefined ? { matchedToolCalls } : {}),
    };
    return {
        id: input.newVerdictId(),
        turnId: input.turnId,
        ruleId: rule.id,
        status,
        detail,
        evaluatedAt: input.now,
    };
}

function findRuleTriggerMatch(
    rule: Rule,
    input: EvaluateTurnInput,
): { phrase: string; index: number } | null {
    if (rule.trigger === undefined) return null;
    // triggerOn이 있으면 지정된 발화자만 보고, 없으면 사용자/어시스턴트 발화를 모두 본다.
    const sources = rule.triggerOn === "user"
        ? [input.userMessageText ?? ""]
        : rule.triggerOn === "assistant"
            ? [input.assistantText]
            : [input.userMessageText ?? "", input.assistantText];

    for (const source of sources) {
        const triggerMatch = findTriggerMatch(source, rule.trigger.phrases);
        if (triggerMatch === null) continue;
        // 부정 표현 바로 뒤의 문구는 사용자가 요구한 트리거로 보지 않는다.
        if (isNegated(source, triggerMatch.index)) continue;
        return triggerMatch;
    }
    return null;
}

export function evaluateTurn(input: EvaluateTurnInput): EvaluateTurnResult {
    const verdicts: TurnVerdict[] = [];
    for (const rule of input.rules) {
        const verdict = evaluateRule(rule, input);
        if (verdict !== null) verdicts.push(verdict);
    }
    return { verdicts };
}
