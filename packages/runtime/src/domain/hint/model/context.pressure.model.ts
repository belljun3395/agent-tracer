import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {PreprocessingHint} from "~runtime/domain/hint/model/hint.model.js";

const USED_PCT_WARNING = 80;
const USED_PCT_CRITICAL = 95;
const RATE_LIMIT_WARNING = 85;
const RATE_LIMIT_CRITICAL = 95;
const SNAPSHOT_FRESHNESS_MS = 10 * 60 * 1000;

/** 컨텍스트 창과 사용량 한도가 임계에 가까우면 알린다. */
export function detectContextPressure(
    recent: readonly RecentEvent[],
    now: number,
): PreprocessingHint[] {
    const snapshot = recent.filter((event) => event.kind === KIND.contextSnapshot).at(-1);
    if (!snapshot) return [];
    const ageMs = now - Date.parse(snapshot.occurredAt);
    if (Number.isFinite(ageMs) && ageMs > SNAPSHOT_FRESHNESS_MS) return [];

    const hints: PreprocessingHint[] = [];
    const usedPct = readNumber(snapshot.metadata, "contextWindowUsedPct");
    if (usedPct !== undefined && usedPct >= USED_PCT_WARNING) {
        const rounded = Math.round(usedPct);
        hints.push({
            type: "context_pressure",
            severity: usedPct >= USED_PCT_CRITICAL ? "critical" : "warning",
            title: `Context window ${rounded}% used`,
            message: usedPct >= USED_PCT_CRITICAL
                ? `Context window is near full (${rounded}%). Compaction is imminent, so keep this turn short and avoid pasting large outputs.`
                : `Context window is ${rounded}% used. Prefer concise responses and avoid re-reading files you already inspected.`,
        });
    }

    const fiveHourPct = readNumber(snapshot.metadata, "rateLimitFiveHourUsedPct");
    if (fiveHourPct !== undefined && fiveHourPct >= RATE_LIMIT_WARNING) {
        const rounded = Math.round(fiveHourPct);
        hints.push({
            type: "context_pressure",
            severity: fiveHourPct >= RATE_LIMIT_CRITICAL ? "critical" : "warning",
            title: `5-hour rate limit ${rounded}% used`,
            message: `5-hour rate window is ${rounded}% consumed. Heavy tool use this turn may exhaust the quota.`,
        });
    }

    return hints;
}

function readNumber(metadata: Record<string, unknown>, key: string): number | undefined {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
