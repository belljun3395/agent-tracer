import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";

export interface KvPair {
  readonly key: string;
  readonly value: string;
}

/** inspector의 KV 그리드를 위해 식별용 메타데이터 몇 개를 뽑는다. */
export function eventToKvPairs(event: TimelineEventRecord): readonly KvPair[] {
  const out: KvPair[] = [];
  const meta = event.metadata;

  if (event.sessionId) {
    out.push({ key: "session", value: event.sessionId });
  }
  pushString(out, meta, "runtime");
  pushString(out, meta, "hook");

  const filePath = event.paths?.primaryPath ?? event.paths?.filePaths[0];
  if (filePath) {
    out.push({ key: "file", value: filePath });
  }

  pushString(out, meta, "traceId", "trace_id");
  pushString(out, meta, "parentEventId", "parent_event_id", "parent");

  return out;
}

function pushString(
  out: KvPair[],
  meta: Record<string, unknown>,
  ...keys: readonly string[]
): void {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.length > 0) {
      out.push({ key: keys[0]!, value: v });
      return;
    }
  }
}
