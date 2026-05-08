import type { TimelineEventRecord } from "~domain/monitoring.js";

/**
 * Token usage extracted from event metadata. The backend writes tokens in
 * one of several shapes (provider-specific keys, snake_case vs camelCase,
 * sometimes wrapped in `usage`); this normalises everything into a single
 * canonical view-model so the renderer doesn't carry that branching.
 */
export interface TokensVm {
  readonly total: number | null;
  readonly input: number | null;
  readonly output: number | null;
}

const MAX_PATHS = 5;

/**
 * Distinct file paths surfaced by the event, in priority order:
 *   1. paths.primaryPath  (most relevant — the canonical target)
 *   2. paths.filePaths    (every file actually touched)
 *   3. paths.mentionedPaths (paths only referenced, not touched)
 *
 * Capped at MAX_PATHS so a sweeping `apply_patch` doesn't explode the
 * feed card.
 */
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

/**
 * Pull token counts out of event metadata, regardless of the variant the
 * backend wrote. Returns null if no token-shaped fields are present.
 */
export function extractTokens(event: TimelineEventRecord): TokensVm | null {
  const meta = event.metadata;
  const usage = isRecord(meta["usage"]) ? meta["usage"] : null;

  const input = pickNumber(meta, usage, [
    "input_tokens",
    "inputTokens",
    "in",
    "input",
    "promptTokens",
    "prompt_tokens",
  ]);
  const output = pickNumber(meta, usage, [
    "output_tokens",
    "outputTokens",
    "out",
    "output",
    "completionTokens",
    "completion_tokens",
  ]);
  let total = pickNumber(meta, usage, ["tokens", "total_tokens", "totalTokens"]);
  if (total === null && (input !== null || output !== null)) {
    total = (input ?? 0) + (output ?? 0);
    if (total === 0) total = null;
  }

  if (total === null && input === null && output === null) return null;
  return { total, input, output };
}

/**
 * Compact thousands suffix for token / event counts. Keeps the feed meta
 * line scannable: "2.4k" instead of "2419".
 */
export function formatCompactCount(value: number): string {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return k >= 100 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}

function pickNumber(
  meta: Record<string, unknown>,
  usage: Record<string, unknown> | null,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (usage) {
      const u = usage[key];
      if (typeof u === "number" && Number.isFinite(u) && u >= 0) return u;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
