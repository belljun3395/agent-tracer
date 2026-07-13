import { AGENT_TRACER_ATTR, KIND } from "@monitor/kernel";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import type { VerdictStatus } from "~web/entities/rule/model/rule.js";
import { classifyEvent, type ActVm } from "~web/widgets/feed/lib/timeline/act-classification.js";
import { formatHHmmss } from "~web/shared/lib/formatting/time.js";
import { findTurnAtMs } from "~web/widgets/feed/lib/timeline/find-turn-at.js";
import { isContextCompactEvent } from "~web/widgets/feed/lib/timeline/is-compact.js";
import { readContextSnapshot } from "~web/widgets/feed/lib/extraction/extract-context.js";

/** time-mark는 세로 피드를 밴드로 나누고, act는 실제 카드다. */
export type FeedItem =
  | {
      readonly kind: "time-mark";
      readonly label: string;
      readonly tone: "normal" | "compact";
      /** 연속으로 병합된 이벤트 수. 1보다 클 때만 존재한다(compact tone). */
      readonly count?: number;
    }
  | {
      readonly kind: "turn-mark";
      readonly turnIndex: number;
      readonly verdict: VerdictStatus | null;
      readonly status: "open" | "closed";
    }
  | {
      readonly kind: "context-mark";
      readonly percent: number;
      readonly model: string | null;
      /** 이 시점에 모델 식별자가 바뀌었으면 true. */
      readonly modelChanged: boolean;
      /** 마지막으로 표시한 마크 대비 부호가 있는 증감(퍼센트 포인트). */
      readonly deltaPct: number;
    }
  | { readonly kind: "act"; readonly vm: ActVm };

const CONTEXT_DELTA_THRESHOLD = 5;

const MODEL_KEYS = ["modelId", "model_id", "model"] as const;

function readModel(meta: Record<string, unknown>): string | null {
  for (const key of MODEL_KEYS) {
    const v = meta[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

export function buildFeed(
  events: readonly TimelineEventRecord[],
  baseMs: number,
  turns: readonly TaskTurnSummary[] = [],
): readonly FeedItem[] {
  const sorted = orderEventsForFeed(events);

  const items: FeedItem[] = [];
  if (sorted.length > 0) {
    items.push({
      kind: "time-mark",
      label: `Task started · ${formatHHmmss(baseMs)}`,
      tone: "normal",
    });
  }

  let lastTurnIndex: number | null = null;
  let lastEmittedContextPct: number | null = null;
  let lastEmittedModel: string | null = null;
  for (const event of sorted) {
    // 컨텍스트 스냅샷(모델 상태, 토큰 사용량)은 모델이 바뀌었거나 마지막 표시 이후 컨텍스트 %가 임계값 이상 변한 경우, 즉 실행 상태에 실질적 변화가 있을 때만
    // 인라인 마크로 표시한다.
    if (event.kind === KIND.contextSnapshot) {
      const snapshot = readContextSnapshot(event);
      if (snapshot) {
        const model = readModel(event.metadata);
        const modelChanged =
          model !== null && lastEmittedModel !== null && model !== lastEmittedModel;
        const deltaPct =
          lastEmittedContextPct === null
            ? snapshot.percent
            : snapshot.percent - lastEmittedContextPct;
        const significantContext =
          lastEmittedContextPct === null ||
          Math.abs(deltaPct) >= CONTEXT_DELTA_THRESHOLD;
        if (modelChanged || significantContext) {
          items.push({
            kind: "context-mark",
            percent: snapshot.percent,
            model,
            modelChanged,
            deltaPct,
          });
          lastEmittedContextPct = snapshot.percent;
          if (model !== null) lastEmittedModel = model;
        } else if (model !== null && lastEmittedModel === null) {
          // 처음 관측된 모델을 기록해, 컨텍스트 %가 그대로여도 이후
          // 비교에서 변경을 감지할 수 있게 한다.
          lastEmittedModel = model;
        }
      }
      // 마크가 대체하므로 ActCard 렌더링으로 넘어가지 않는다.
      continue;
    }
    if (isContextCompactEvent(event)) {
      // 연속된 compact를 구분선 하나로 합친다.
      const tail = items[items.length - 1];
      if (tail && tail.kind === "time-mark" && tail.tone === "compact") {
        items[items.length - 1] = {
          ...tail,
          count: (tail.count ?? 1) + 1,
        };
      } else {
        items.push({
          kind: "time-mark",
          label: "Context compacted",
          tone: "compact",
        });
      }
      continue;
    }

    // 이 이벤트가 이전과 다른 턴에 속하면 act보다 *먼저* turn-mark를 표시한다.
    const turn = event.turnId
      ? turns.find((candidate) => candidate.id === event.turnId)
      : findTurnAtMs(Date.parse(event.createdAt), turns);
    if (turn && turn.turnIndex !== lastTurnIndex) {
      items.push({
        kind: "turn-mark",
        turnIndex: turn.turnIndex,
        verdict: turn.aggregateVerdict,
        status: turn.status,
      });
      lastTurnIndex = turn.turnIndex;
    }

    items.push({ kind: "act", vm: classifyEvent(event, baseMs) });
  }
  return items;
}

function orderEventsForFeed(
  events: readonly TimelineEventRecord[],
): readonly TimelineEventRecord[] {
  const chronological = [...events].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const byId = new Map(chronological.map((event) => [event.id, event]));
  const deferredByResponse = new Map<string, TimelineEventRecord[]>();
  const deferredIds = new Set<string>();

  for (const event of chronological) {
    if (event.kind !== KIND.assistantCommentary) continue;
    const responseId = readTurnResponseEventId(event);
    if (!responseId) continue;
    const response = byId.get(responseId as TimelineEventRecord["id"]);
    if (!response || response.kind !== KIND.assistantResponse) continue;
    if (event.taskId !== response.taskId || event.sessionId !== response.sessionId) continue;
    if (Date.parse(event.createdAt) < Date.parse(response.createdAt)) continue;

    const pending = deferredByResponse.get(responseId) ?? [];
    pending.push(event);
    deferredByResponse.set(responseId, pending);
    deferredIds.add(event.id);
  }

  if (deferredIds.size === 0) return chronological;
  const ordered: TimelineEventRecord[] = [];
  for (const event of chronological) {
    if (deferredIds.has(event.id)) continue;
    ordered.push(...(deferredByResponse.get(event.id) ?? []), event);
  }
  return ordered;
}

function readTurnResponseEventId(event: TimelineEventRecord): string | null {
  const value = event.metadata[AGENT_TRACER_ATTR.turnResponseEventId];
  return typeof value === "string" && value.length > 0 ? value : null;
}
