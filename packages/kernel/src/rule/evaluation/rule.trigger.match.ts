import { RULE_TRIGGER_SOURCE, type RuleTrigger, type RuleTriggerSource } from "../definition/rule.vocabulary.js";

const MIN_STEM_LENGTH = 2;

const KOREAN_SUFFIXES: readonly string[] = [
    "해주세요", "했습니다", "하겠습니다", "해야해요", "합니다", "해주라", "해줘요", "하세요",
    "했어요", "해야지", "해야해", "했었다", "해줄래", "이라고", "에게서", "에서는", "으로는",
    "해줘", "해줌", "해서", "해야", "했어", "했다", "한다", "하고", "하기", "하는", "하지",
    "하자", "하라", "해라", "해도", "해야만",
    "에게", "께서", "에서", "으로", "라고", "한테", "까지", "부터", "보다", "처럼", "마다",
    "조차", "밖에", "이나", "이랑",
    "을", "를", "이", "가", "은", "는", "에", "와", "과", "도", "만", "의", "로", "랑", "해", "함",
];

export function normalizeMatchText(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function hasCjk(value: string): boolean {
    return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
}

export function stemToken(token: string): string {
    for (const suffix of KOREAN_SUFFIXES) {
        if (!token.endsWith(suffix)) continue;
        const stem = token.slice(0, token.length - suffix.length);
        if (stem.length >= MIN_STEM_LENGTH) return stem;
    }
    return token;
}

export function stemTokens(text: string): string[] {
    return normalizeMatchText(text)
        .split(" ")
        .filter((token) => token.length > 0)
        .map(stemToken);
}

const NEGATION_PREFIX_MARKERS: readonly string[] = [
    "did not ", "didn't ", "not ", "haven't ", "have not ", "never ", "no ", "couldn't ", "could not ",
    "안 ", "못 ",
];
const NEGATION_SUFFIX_MARKERS: readonly string[] = [
    "하지 마", "하지말", "하지 말", "하지 않", "지 마세요", "말고", "말아", "금지", "없이",
];
const NEGATION_LOOKBACK = 20;
const NEGATION_LOOKAHEAD = 16;

function isNegatedAt(text: string, matchIndex: number, matchLength: number): boolean {
    const before = text.slice(Math.max(0, matchIndex - NEGATION_LOOKBACK), matchIndex);
    if (NEGATION_PREFIX_MARKERS.some((marker) => before.includes(marker))) return true;
    const afterStart = matchIndex + matchLength;
    const after = text.slice(afterStart, afterStart + NEGATION_LOOKAHEAD);
    return NEGATION_SUFFIX_MARKERS.some((marker) => after.includes(marker));
}

function lastStemIndex(text: string, stems: readonly string[]): { index: number; length: number } {
    let best = { index: 0, length: 0 };
    for (const stem of stems) {
        const at = text.lastIndexOf(stem);
        if (at >= best.index) best = { index: at, length: stem.length };
    }
    return best;
}

/** 규칙 트리거 문구와 발화를 서버와 로컬 런타임에서 같은 기준으로 대조한다. */
export function matchesPhrase(phrase: string, text: string, negationAware: boolean): boolean {
    const normalizedPhrase = normalizeMatchText(phrase);
    const normalizedText = normalizeMatchText(text);
    if (normalizedPhrase === "" || normalizedText === "") return false;

    const exact = normalizedText.indexOf(normalizedPhrase);
    if (exact !== -1) {
        return !(negationAware && isNegatedAt(normalizedText, exact, normalizedPhrase.length));
    }
    if (!hasCjk(normalizedPhrase)) return false;

    const phraseStems = stemTokens(normalizedPhrase);
    if (phraseStems.length === 0) return false;
    const textStems = new Set(stemTokens(normalizedText));
    if (!phraseStems.every((stem) => textStems.has(stem))) return false;

    const located = lastStemIndex(normalizedText, phraseStems);
    return !(negationAware && isNegatedAt(normalizedText, located.index, located.length));
}

export interface TriggerCandidate {
    readonly speaker: RuleTriggerSource | "other";
    readonly text: string;
}

function triggerOnAllows(on: RuleTriggerSource | undefined, speaker: TriggerCandidate["speaker"]): boolean {
    if (on === RULE_TRIGGER_SOURCE.user) return speaker === RULE_TRIGGER_SOURCE.user;
    if (on === RULE_TRIGGER_SOURCE.assistant) return speaker === RULE_TRIGGER_SOURCE.assistant;
    return speaker === RULE_TRIGGER_SOURCE.user || speaker === RULE_TRIGGER_SOURCE.assistant;
}

export function findTriggerPhrase(
    trigger: RuleTrigger | null,
    candidates: readonly TriggerCandidate[],
    negationAware: boolean,
): string | null {
    if (trigger === null || trigger.phrases.length === 0) return null;
    for (const candidate of candidates) {
        if (!triggerOnAllows(trigger.on, candidate.speaker)) continue;
        for (const phrase of trigger.phrases) {
            if (matchesPhrase(phrase, candidate.text, negationAware)) return phrase;
        }
    }
    return null;
}
