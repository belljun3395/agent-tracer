import { KIND } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export interface ContextSnapshot {
  readonly used: number;
  readonly limit: number;
  readonly percent: number;
  readonly atMs: number;
}

// Claude Code의 StatusLine 훅이 내보내는 표준 키.
const USED_KEYS = [
  "contextWindowTotalTokens",
  "used_tokens",
  "usedTokens",
  "used",
  "tokens",
] as const;
const LIMIT_KEYS = [
  "contextWindowSize",
  "limit_tokens",
  "limitTokens",
  "limit",
  "context_limit",
] as const;
const PERCENT_KEYS = ["contextWindowUsedPct", "used_percentage", "usedPct"] as const;
const FALLBACK_LIMIT_TOKENS = 200_000;

/** 타임라인에서 가장 최근 컨텍스트 스냅샷을 고른다. */
export function extractContextSnapshot(
  events: readonly TimelineEventRecord[],
): ContextSnapshot | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (
      event.kind !== KIND.contextSnapshot &&
      event.kind !== KIND.tokenUsage &&
      event.kind !== KIND.contextSaved
    ) {
      continue;
    }
    const snapshot = readContextSnapshot(event);
    if (snapshot) return snapshot;
  }
  return null;
}

/** 배치 소비자(추이 빌더, 토큰 합계 롤업)를 위해 노출하는 저수준 리더. */
export function readContextSnapshot(
  event: TimelineEventRecord,
): ContextSnapshot | null {
  const used = readNumber(event.metadata, USED_KEYS);
  const limit = readNumber(event.metadata, LIMIT_KEYS);
  const percent = readNumber(event.metadata, PERCENT_KEYS);
  const atMs = Date.parse(event.createdAt);

  if (used !== null && limit !== null && limit > 0) {
    return {
      used,
      limit,
      percent: Math.round((used / limit) * 100),
      atMs,
    };
  }
  // 원시 used 값은 없지만 runtime이 percent를 직접 알려준 경우다.
  if (percent !== null) {
    const effectiveLimit =
      limit !== null && limit > 0 ? limit : FALLBACK_LIMIT_TOKENS;
    return {
      used: Math.round((percent / 100) * effectiveLimit),
      limit: effectiveLimit,
      percent: Math.round(percent),
      atMs,
    };
  }
  return null;
}

function readNumber(
  meta: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  return null;
}
