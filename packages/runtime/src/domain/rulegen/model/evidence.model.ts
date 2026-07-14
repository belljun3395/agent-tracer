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

/** 규칙 생성에 필요한 사용자 요구와 응답 요약이며 turnId는 모델이 이 턴을 인용할 때 쓰는 식별자다. */
export interface TurnDigest {
    readonly turnId: string;
    readonly turnIndex: number;
    readonly askedText: string;
    readonly assistantSummary: string;
}

/** 규칙 생성 프롬프트에 싣는 에이전트 활동 근거이며 eventId는 모델이 이 이벤트를 인용할 때 쓰는 식별자다. */
export interface EventEvidence {
    readonly eventId: string;
    readonly turnId?: string;
    readonly kind: string;
    readonly title: string;
    readonly body: string;
}

/** 중복 제안을 피하려고 제공하는 기존 규칙 근거다. */
export interface ExistingRuleEvidence {
    readonly name: string;
    readonly expect: unknown;
}

function readString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === "string" && value.length > 0 ? value : null;
}

/** 인용할 수 없는 근거는 모델에게 보여 줘도 규칙을 붙들지 못하므로 식별자가 없는 항목은 버린다. */
export function digestTurns(items: readonly unknown[]): TurnDigest[] {
    const digests: TurnDigest[] = [];
    for (const item of items) {
        if (!isRecord(item)) continue;
        const turnId = readString(item, "id");
        const askedText = readString(item, "askedText");
        if (turnId === null || askedText === null) continue;
        const rawIndex = item["turnIndex"];
        digests.push({
            turnId,
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
        const eventId = readString(item, "id");
        const kind = item["kind"];
        if (eventId === null || typeof kind !== "string") continue;
        const turnId = readString(item, "turnId");
        events.push({
            eventId,
            ...(turnId === null ? {} : {turnId}),
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
            expect: item["expectation"] ?? null,
        });
    }
    return rules;
}
