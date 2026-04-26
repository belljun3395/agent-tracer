import type { TurnVerdict, VerdictStatus } from "~domain/verification/index.js";

export interface VerdictRow {
    readonly id: string;
    readonly turn_id: string;
    readonly rule_id: string;
    readonly status: string;
    readonly detail_json: string;
    readonly evaluated_at: string;
}

export function mapVerdictRow(row: VerdictRow): TurnVerdict {
    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(row.detail_json) as Record<string, unknown>;
    } catch {
        parsed = {};
    }
    const detail: TurnVerdict["detail"] = {
        actualToolCalls: Array.isArray(parsed.actualToolCalls)
            ? parsed.actualToolCalls.filter((v): v is string => typeof v === "string")
            : [],
    };
    if (typeof parsed.matchedPhrase === "string") {
        detail.matchedPhrase = parsed.matchedPhrase;
    }
    if (typeof parsed.expectedPattern === "string") {
        detail.expectedPattern = parsed.expectedPattern;
    }
    if (Array.isArray(parsed.matchedToolCalls)) {
        detail.matchedToolCalls = parsed.matchedToolCalls.filter(
            (v): v is string => typeof v === "string",
        );
    }
    return {
        id: row.id,
        turnId: row.turn_id,
        ruleId: row.rule_id,
        status: row.status as VerdictStatus,
        detail,
        evaluatedAt: row.evaluated_at,
    };
}
