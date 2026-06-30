import { RULE_TRIGGER_SOURCE } from "@monitor/rules-api/domain/rule/const/rule.const.js";
import type { Rule } from "@monitor/rules-api/public/rule/types/rule.types.js";

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
    if (triggerOn === RULE_TRIGGER_SOURCE.user) return speaker === RULE_TRIGGER_SOURCE.user;
    if (triggerOn === RULE_TRIGGER_SOURCE.assistant) return speaker === RULE_TRIGGER_SOURCE.assistant;
    // triggerOn이 없으면 사용자/어시스턴트 발화만 본다.
    return speaker === RULE_TRIGGER_SOURCE.user || speaker === RULE_TRIGGER_SOURCE.assistant;
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

// 룰 트리거 문구가 어느 발화 후보에 나타나는지 판정한다.
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
