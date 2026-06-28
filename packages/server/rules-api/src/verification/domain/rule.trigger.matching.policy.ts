import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";

export interface TriggerCandidate {
    readonly speaker: "user" | "assistant" | "other";
    readonly text: string;
}

export interface TriggerMatch {
    readonly phrase: string;
    readonly index: number;
}

export interface MatchRuleTriggerOptions {
    // negationAware면 부정 표현 바로 뒤의 문구는 트리거로 보지 않는다.
    readonly negationAware: boolean;
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

function triggerOnAllows(triggerOn: Rule["triggerOn"], speaker: TriggerCandidate["speaker"]): boolean {
    if (triggerOn === "user") return speaker === "user";
    if (triggerOn === "assistant") return speaker === "assistant";
    // triggerOn이 없으면 사용자/어시스턴트 발화만 본다.
    return speaker === "user" || speaker === "assistant";
}

function findPhraseMatch(text: string, phrases: readonly string[]): TriggerMatch | null {
    const lower = text.toLowerCase();
    for (const phrase of phrases) {
        const idx = lower.indexOf(phrase.toLowerCase());
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

// 룰 트리거 문구가 어느 발화 후보에 나타나는지 판정하는 단일 출처.
// turn 평가와 event enforcement가 모두 이 함수를 쓰되, negation 적용 여부만 옵션으로 고른다.
export function matchRuleTrigger(
    rule: Rule,
    candidates: readonly TriggerCandidate[],
    options: MatchRuleTriggerOptions,
): TriggerMatch | null {
    if (rule.trigger === undefined || rule.trigger.phrases.length === 0) return null;
    for (const candidate of candidates) {
        if (!triggerOnAllows(rule.triggerOn, candidate.speaker)) continue;
        const match = findPhraseMatch(candidate.text, rule.trigger.phrases);
        if (match === null) continue;
        if (options.negationAware && isNegated(candidate.text, match.index)) continue;
        return match;
    }
    return null;
}
