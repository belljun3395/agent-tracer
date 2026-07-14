import {isRecord} from "~runtime/support/json.js";
import {truncate} from "~runtime/support/text.js";

export const TURN_DIGEST_MAX_TURNS = 30;
export const ASKED_TEXT_MAX_LEN = 2000;
export const ASSISTANT_SUMMARY_MAX_LEN = 300;
export const EVENT_TITLE_MAX_LEN = 200;
export const EVENT_BODY_MAX_LEN = 200;
export const EXISTING_RULE_NAME_MAX_LEN = 100;
export const TIMELINE_PAGE_LIMIT = 100;
export const TIMELINE_MAX_PAGES = 10;

/** 규칙 생성에 필요한 사용자 요구와 응답 요약이다. */
export interface TurnDigest {
    readonly turnIndex: number;
    readonly askedText: string;
    readonly assistantSummary: string;
}

/** 규칙 생성 프롬프트에 싣는 에이전트 활동 근거다. */
export interface EventEvidence {
    readonly kind: string;
    readonly title: string;
    readonly body: string;
}

/** 중복 제안을 피하려고 제공하는 기존 규칙 근거다. */
export interface ExistingRuleEvidence {
    readonly name: string;
    readonly trigger: unknown;
    readonly expect: unknown;
}

function readString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : null;
}

export function digestTurns(items: readonly unknown[]): TurnDigest[] {
    const digests: TurnDigest[] = [];
    for (const item of items) {
        if (!isRecord(item)) continue;
        const askedText = readString(item, "askedText");
        if (askedText === null) continue;
        const rawIndex = item["turnIndex"];
        digests.push({
            turnIndex: typeof rawIndex === "number" ? rawIndex : digests.length + 1,
            askedText: truncate(askedText, ASKED_TEXT_MAX_LEN),
            assistantSummary: truncate(readString(item, "assistantText") ?? "", ASSISTANT_SUMMARY_MAX_LEN),
        });
    }
    return digests.slice(-TURN_DIGEST_MAX_TURNS);
}

export function digestEvents(items: readonly unknown[]): EventEvidence[] {
    const events: EventEvidence[] = [];
    for (const item of items) {
        if (!isRecord(item)) continue;
        const kind = item["kind"];
        if (typeof kind !== "string") continue;
        events.push({
            kind,
            title: truncate(readString(item, "title") ?? "", EVENT_TITLE_MAX_LEN),
            body: truncate(readString(item, "body") ?? "", EVENT_BODY_MAX_LEN),
        });
    }
    return events;
}

export function digestExistingRules(items: readonly unknown[]): ExistingRuleEvidence[] {
    const rules: ExistingRuleEvidence[] = [];
    for (const item of items) {
        if (!isRecord(item)) continue;
        rules.push({
            name: truncate(readString(item, "name") ?? "", EXISTING_RULE_NAME_MAX_LEN),
            trigger: item["trigger"] ?? null,
            expect: item["expect"] ?? null,
        });
    }
    return rules;
}
