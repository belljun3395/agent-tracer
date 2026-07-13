import { SEMCONV_ATTR } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

/** 이벤트 속성에서 뽑아낸 토큰 사용량. */
export interface TokensVm {
  readonly total: number | null;
  readonly input: number | null;
  readonly output: number | null;
}

const MAX_PATHS = 5;

/** 이벤트가 드러내는 고유 파일 경로. */
export function extractPaths(event: TimelineEventRecord): readonly string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (p: string | undefined) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    ordered.push(p);
  };

  push(event.paths?.primaryPath);
  for (const p of event.paths?.filePaths ?? []) push(p);
  for (const p of event.paths?.mentionedPaths ?? []) push(p);

  return ordered.slice(0, MAX_PATHS);
}

/** 이벤트 속성에서 토큰 수를 뽑아낸다. */
export function extractTokens(event: TimelineEventRecord): TokensVm | null {
  const meta = event.metadata;

  const input = readNumber(meta[SEMCONV_ATTR.inputTokens]);
  const output = readNumber(meta[SEMCONV_ATTR.outputTokens]);
  let total = readNumber(meta["totalTokens"]);
  if (total === null && (input !== null || output !== null)) {
    total = (input ?? 0) + (output ?? 0);
    if (total === 0) total = null;
  }

  if (total === null && input === null && output === null) return null;
  return { total, input, output };
}

/** 토큰/이벤트 수를 천 단위로 축약한 접미사. */
export function formatCompactCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
