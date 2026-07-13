import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";

export type EdgeKind = "causal" | "explicit";

export interface FeedEdge {
  readonly kind: EdgeKind;
  readonly fromEventId: string;
  readonly toEventId: string;
}

/** 명시적 부모와 시간 순서를 그래프 엣지로 투영한다. */
export function buildFeedEdges(
  events: readonly TimelineEventRecord[],
  _turns: readonly TaskTurnSummary[],
): readonly FeedEdge[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const eventIds = new Set<string>(sorted.map((e) => e.id));
  const seen = new Set<string>(); // 중복 제거 키: `${from}→${to}`
  const out: FeedEdge[] = [];
  const push = (kind: EdgeKind, fromEventId: string, toEventId: string) => {
    if (fromEventId === toEventId) return;
    if (!eventIds.has(fromEventId)) return;
    const key = `${fromEventId}→${toEventId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, fromEventId, toEventId });
  };

  // 1단계: 메타데이터의 explicit parent 링크.
  for (const event of sorted) {
    const explicit = readExplicitParent(event);
    if (explicit) push("explicit", explicit, event.id);
  }

  // 2단계: 시간순으로 연속된 모든 쌍을 체인으로 연결한다.
  for (let i = 1; i < sorted.length; i += 1) {
    push("causal", sorted[i - 1]!.id, sorted[i]!.id);
  }

  return out;
}

function readExplicitParent(event: TimelineEventRecord): string | null {
  const meta = event.metadata;
  for (const key of ["parentEventId", "parent_event_id", "sourceEventId", "source_event_id"]) {
    const v = meta[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
