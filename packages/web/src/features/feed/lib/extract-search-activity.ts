import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { EventSubtypeKey } from "~domain/classification.js";

export type SearchKind = "grep" | "glob" | "list" | "web" | "shell";

export interface SearchActivityRow {
  readonly kind: SearchKind;
  readonly query: string;
  readonly count: number;
  readonly firstSeenAtMs: number;
  readonly lastSeenAtMs: number;
}

const KIND_BY_SUBTYPE: Readonly<Record<string, SearchKind>> = {
  grep_code: "grep",
  glob_files: "glob",
  list_files: "list",
  web_search: "web",
  web_fetch: "web",
  shell_probe: "shell",
};

const QUERY_KEYS = [
  "query",
  "pattern",
  "searchTerm",
  "search",
  "url",
  "command",
  "cmd",
  "input",
] as const;

function pickQuery(metadata: Record<string, unknown>, fallback: string): string {
  for (const key of QUERY_KEYS) {
    const v = metadata[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function isSearchSubtype(key: EventSubtypeKey | undefined): key is EventSubtypeKey {
  return key != null && key in KIND_BY_SUBTYPE;
}

/**
 * Aggregate search-shaped events (grep / glob / list / web / shell-probe)
 * keyed by `<kind>::<query>`. Repeated queries collapse into one row with
 * a hit count, so a task that ran the same `grep -r foo` ten times shows
 * once with `×10` instead of dominating the table.
 *
 * Sorted by `lastSeenAtMs` desc — recent-first matches the operator
 * mental model of "what did the agent just look up".
 */
export function buildSearchActivity(
  events: readonly TimelineEventRecord[],
): readonly SearchActivityRow[] {
  type Aggregate = {
    kind: SearchKind;
    query: string;
    count: number;
    firstSeenAtMs: number;
    lastSeenAtMs: number;
  };
  const byKey = new Map<string, Aggregate>();

  for (const event of events) {
    const subtype = event.semantic?.subtypeKey;
    if (!isSearchSubtype(subtype)) continue;
    const kind = KIND_BY_SUBTYPE[subtype]!;
    const query = pickQuery(event.metadata, event.title || "(no query)");
    const ms = Date.parse(event.createdAt);
    const key = `${kind}::${query}`;
    let agg = byKey.get(key);
    if (!agg) {
      agg = {
        kind,
        query,
        count: 0,
        firstSeenAtMs: ms,
        lastSeenAtMs: ms,
      };
      byKey.set(key, agg);
    }
    agg.count += 1;
    if (ms < agg.firstSeenAtMs) agg.firstSeenAtMs = ms;
    if (ms > agg.lastSeenAtMs) agg.lastSeenAtMs = ms;
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.lastSeenAtMs - a.lastSeenAtMs,
  );
}
