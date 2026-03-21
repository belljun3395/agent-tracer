/**
 * @module timeline
 *
 * 타임라인 레이아웃 계산 유틸리티.
 * 이벤트 좌표 계산, 연결선 경로 생성, 타임스탬프 눈금, 상대 시간 변환을 담당.
 */

import type {
  TimelineEvent,
  TimelineLane,
  TimelineRelation
} from "../types.js";

/** 타임라인 캔버스에서 이벤트 노드 한 항목의 레이아웃 정보. */
export interface TimelineItemLayout {
  readonly event: TimelineEvent;
  readonly left: number;
  readonly top: number;
  /** 같은 레인에서 수평 겹침 발생 시 수직 분산 행 인덱스. 0 = 앞(front). */
  readonly rowIndex: number;
}

/** 전체 타임라인 캔버스 레이아웃: 너비, "now" 선 위치, 항목 배열. */
export interface TimelineLayout {
  readonly width: number;
  readonly nowLeft: number;
  readonly items: readonly TimelineItemLayout[];
  /** 타임스탬프(ms)를 캔버스 x 좌표(px)로 변환. */
  readonly tsToLeft: (ms: number) => number;
}

/** 측정된 DOM 노드의 바운딩 박스. 정확한 연결선 경로 계산에 사용. */
export interface TimelineNodeBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** 두 이벤트 노드를 잇는 SVG 연결선 데이터. */
export interface TimelineConnector {
  readonly key: string;
  readonly path: string;
  readonly lane: TimelineLane;
  readonly cross: boolean;
  readonly sourceEventId: string;
  readonly targetEventId: string;
  readonly sourceLane: TimelineLane;
  readonly targetLane: TimelineLane;
  readonly relationType?: string;
  readonly label?: string;
  readonly explanation?: string;
  readonly isExplicit: boolean;
  readonly workItemId?: string;
  readonly goalId?: string;
  readonly planId?: string;
  readonly handoffId?: string;
}

/** 타임라인에 표시되는 레인 순서. */
export const TIMELINE_LANES: readonly TimelineLane[] = [
  "user",
  "questions",
  "todos",
  "planning",
  "coordination",
  "exploration",
  "implementation",
  "background"
];

/** 레인 한 행의 픽셀 높이. */
export const LANE_HEIGHT   = 80;
/** 타임스탬프 눈금 영역 높이. */
export const RULER_HEIGHT  = 32;
/** 이벤트 노드 카드 너비 (CSS .event-node width와 일치해야 함). */
export const NODE_WIDTH    = 152;
/** 이벤트 카드 대략적 렌더링 높이. */
export const NODE_HEIGHT   = 76;
/** 레인 라벨 영역 너비. */
export const LEFT_GUTTER = 176;
const CLUSTER_STAGGER = NODE_WIDTH + 8; // px shift between stacked same-lane same-time nodes
/** 겹치는 카드를 수직으로 분산할 때 각 행(row) 간 픽셀 오프셋. */
export const ROW_VERTICAL_OFFSET = 14;

/**
 * 이벤트 목록을 5-레인 타임라인 레이아웃으로 변환.
 * 각 이벤트의 x(시간), y(레인) 좌표를 계산하며,
 * 같은 레인·같은 시간대에 겹치는 노드는 수평으로 분산시킴.
 *
 * @param events - 레이아웃을 계산할 이벤트 목록
 * @param zoom - 수평 스케일 배율 (1 = 기본)
 * @param nowMs - 현재 시각 (ms). "now" 선 위치와 오른쪽 앵커에 사용
 * @returns 캔버스 너비, "now" 선 left 위치, 항목별 좌표 배열
 */
export function buildTimelineLayout(
  events: readonly TimelineEvent[],
  zoom: number,
  nowMs: number = Date.now(),
  activeLanes: readonly TimelineLane[] = TIMELINE_LANES
): TimelineLayout {
  if (events.length === 0) {
    return {
      width: 1200,
      nowLeft: 1200 - 32,
      items: [],
      tsToLeft: () => 1200 - 32
    };
  }

  const timestamps = events.map((event) => Date.parse(event.createdAt));
  const min = Math.min(...timestamps);
  // Right anchor is always "now" so events drift left as time passes.
  const anchor = Math.max(nowMs, Math.max(...timestamps));
  const span = Math.max(anchor - min, 1);
  const contentWidth = Math.max(1200, Math.round(events.length * 150 * zoom));
  const trackWidth = contentWidth - LEFT_GUTTER - 64;

  // Reserve NODE_WIDTH/2 on each side so nodes never clip behind the lane label or right edge.
  const NODE_HALF = NODE_WIDTH / 2;
  const trackStart = LEFT_GUTTER + NODE_HALF;
  const trackEnd = trackStart + Math.max(1, trackWidth - NODE_HALF * 2);
  const usableTrack = Math.max(1, trackWidth - NODE_HALF * 2);

  const nowLeft = trackStart + Math.round(((nowMs - min) / span) * usableTrack);

  // Base positions
  const rawItems = events.map((event) => {
    const laneIndex = activeLanes.indexOf(event.lane);
    const timePosition = (Date.parse(event.createdAt) - min) / span;
    return {
      event,
      left: trackStart + Math.round(timePosition * usableTrack),
      top: RULER_HEIGHT + laneIndex * LANE_HEIGHT + 18
    };
  });

  // Detect clusters: same lane + left within NODE_WIDTH → spread horizontally
  // Group by lane, then sort by left, then find runs of items within NODE_WIDTH of each other
  const byLane = new Map<string, typeof rawItems>();
  for (const item of rawItems) {
    const key = item.event.lane;
    const laneItems = byLane.get(key);
    if (laneItems) {
      laneItems.push(item);
      continue;
    }

    byLane.set(key, [item]);
  }

  const adjusted = new Map<TimelineEvent, number>(); // event → adjusted left

  for (const laneItems of byLane.values()) {
    const sorted = [...laneItems].sort((a, b) => a.left - b.left);
    let i = 0;
    while (i < sorted.length) {
      const currentItem = sorted[i];
      if (!currentItem) break;

      // Collect cluster: all items within NODE_WIDTH of sorted[i].left
      const anchor = currentItem.left;
      const cluster: typeof sorted = [];
      while (i < sorted.length) {
        const candidate = sorted[i];
        if (!candidate || candidate.left - anchor >= NODE_WIDTH) break;

        cluster.push(candidate);
        i++;
      }
      if (cluster.length === 1) continue; // no overlap, keep original
      // Spread cluster: center around anchor
      const total = (cluster.length - 1) * CLUSTER_STAGGER;
      const distributedLefts = cluster.map((_, idx) => anchor - total / 2 + idx * CLUSTER_STAGGER);
      const minLeft = Math.min(...distributedLefts);
      const maxLeft = Math.max(...distributedLefts);
      let shift = 0;

      if (minLeft < trackStart) {
        shift = trackStart - minLeft;
      } else if (maxLeft > trackEnd) {
        shift = trackEnd - maxLeft;
      }

      for (const [idx, item] of cluster.entries()) {
        const distributedLeft = distributedLefts[idx];
        if (distributedLeft === undefined) continue;
        adjusted.set(item.event, distributedLeft + shift);
      }
    }
  }

  const spreadItems = rawItems.map((item) =>
    adjusted.has(item.event)
      ? { ...item, left: Math.round(adjusted.get(item.event) ?? item.left) }
      : item
  );

  // Post-clustering: 동일 레인에서 여전히 수평 겹침이 발생하는 카드를 수직 행으로 분산.
  // 각 레인에서 left 순으로 정렬 후 그리디하게 가장 낮은 비어있는 행에 배치.
  const laneItemsForRows = new Map<TimelineLane, typeof spreadItems>();
  for (const item of spreadItems) {
    const list = laneItemsForRows.get(item.event.lane) ?? [];
    list.push(item);
    laneItemsForRows.set(item.event.lane, list);
  }

  const rowIndexMap = new Map<TimelineEvent, number>();
  for (const laneItems of laneItemsForRows.values()) {
    const sorted = [...laneItems].sort((a, b) => a.left - b.left);
    const rowEnds: number[] = []; // 각 행의 마지막 카드 우측 끝 x좌표

    for (const item of sorted) {
      const itemLeft = item.left - NODE_WIDTH / 2;
      const itemRight = item.left + NODE_WIDTH / 2;

      let assigned = -1;
      for (let r = 0; r < rowEnds.length; r++) {
        if ((rowEnds[r] ?? 0) <= itemLeft) {
          assigned = r;
          rowEnds[r] = itemRight;
          break;
        }
      }

      if (assigned === -1) {
        assigned = rowEnds.length;
        rowEnds.push(itemRight);
      }

      rowIndexMap.set(item.event, assigned);
    }
  }

  const items: TimelineItemLayout[] = spreadItems.map((item) => ({
    ...item,
    rowIndex: rowIndexMap.get(item.event) ?? 0
  }));

  const tsToLeft = (ms: number): number =>
    trackStart + Math.round(((ms - min) / span) * usableTrack);

  return { width: contentWidth, nowLeft, items, tsToLeft };
}

/** 타임라인 시간축 눈금 한 항목: 픽셀 x 위치와 레이블 문자열. */
export interface TimestampTick {
  readonly x: number;
  readonly label: string;
}

export interface TimelineContextSummary {
  readonly eventSummary: string;
  readonly laneSummary: string;
  readonly focusSummary: string | null;
}

export const DEFAULT_TIMELINE_VIEWPORT_HEIGHT = RULER_HEIGHT + LANE_HEIGHT * 7;

export function resolveTimelineViewportHeight(contentHeight: number, preferredMaxHeight: number): number {
  return Math.min(contentHeight, preferredMaxHeight);
}

export function buildTimelineContextSummary(input: {
  filteredEventCount: number;
  totalEventCount: number;
  activeLaneCount: number;
  totalLaneCount: number;
  selectedRuleId: string | null;
  selectedTag: string | null;
  showRuleGapsOnly: boolean;
}): TimelineContextSummary {
  const eventSummary = `${input.filteredEventCount}/${input.totalEventCount} events`;
  const laneSummary = input.activeLaneCount === input.totalLaneCount
    ? "All lanes"
    : `${input.activeLaneCount}/${input.totalLaneCount} lanes`;
  const focusSummary = input.showRuleGapsOnly
    ? "Rule gaps"
    : input.selectedRuleId
      ? `Rule: ${input.selectedRuleId}`
      : input.selectedTag
        ? `Tag: ${input.selectedTag}`
        : null;

  return {
    eventSummary,
    laneSummary,
    focusSummary
  };
}

/**
 * 타임라인 시간축 눈금 데이터 생성.
 * 최대 12개의 눈금이 생성되도록 자동으로 간격을 선택함.
 *
 * @param events - 시간 범위 계산에 사용할 이벤트 목록
 * @param layout - buildTimelineLayout 결과 (캔버스 너비 참조)
 * @param nowMs - 현재 시각 (ms). 오른쪽 앵커에 사용
 * @returns x 좌표와 "HH:mm:ss" 형식 레이블 배열
 */
export function buildTimestampTicks(
  events: readonly TimelineEvent[],
  layout: TimelineLayout,
  nowMs: number
): readonly TimestampTick[] {
  if (events.length === 0) return [];

  const timestamps = events.map((e) => Date.parse(e.createdAt));
  const min       = Math.min(...timestamps);
  const anchor    = Math.max(nowMs, Math.max(...timestamps));
  const span      = anchor - min;
  if (span <= 0) return [];

  const trackWidth = layout.width - LEFT_GUTTER - 64;

  // Pick the smallest interval that yields ≤ 12 ticks.
  const candidates = [2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000];
  const interval   = candidates.find((i) => span / i <= 12) ?? 600_000;

  const ticks: TimestampTick[] = [];
  const firstTick = Math.ceil(min / interval) * interval;

  for (let t = firstTick; t <= anchor + interval; t += interval) {
    const ratio = (t - min) / span;
    const x     = LEFT_GUTTER + Math.round(ratio * trackWidth);
    if (x < LEFT_GUTTER || x > layout.width) continue;

    const d = new Date(t);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    ticks.push({ x, label: `${h}:${m}:${s}` });
  }

  return ticks;
}

/**
 * 타임라인 이벤트 간 연결선 데이터 생성.
 * 이벤트를 시간순으로 정렬한 뒤 인접 쌍마다 SVG path를 계산함.
 * 같은 레인은 수평선, 다른 레인은 꺾인 경로로 표현.
 *
 * @param items - buildTimelineLayout의 items 배열
 * @param nodeBoundsById - DOM 측정값 맵 (없으면 추정값 사용)
 * @returns 연결선 SVG path 및 메타 정보 배열
 */
export function buildTimelineConnectors(
  items: readonly TimelineItemLayout[],
  nodeBoundsById: Readonly<Record<string, TimelineNodeBounds>> = {}
): readonly TimelineConnector[] {
  const relations = buildTimelineRelations(items.map((item) => item.event));
  const itemById = new Map(items.map((item) => [item.event.id, item]));

  const sorted = [...items].sort((a, b) => {
    const dt = Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
    if (dt !== 0) return dt;

    const laneOrder =
      TIMELINE_LANES.indexOf(a.event.lane) - TIMELINE_LANES.indexOf(b.event.lane);
    if (laneOrder !== 0) return laneOrder;

    return a.left - b.left;
  });

  const incomingExplicitTargets = new Set(relations.map((relation) => relation.targetEventId));
  const fallbackRelations: TimelineRelation[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const source = sorted[index];
    const target = sorted[index + 1];
    if (!source || !target || incomingExplicitTargets.has(target.event.id)) {
      continue;
    }

    fallbackRelations.push({
      sourceEventId: source.event.id,
      targetEventId: target.event.id,
      relationType: "relates_to",
      label: "sequence",
      explanation: "Fallback chronological flow.",
      isExplicit: false
    });
  }

  const result: TimelineConnector[] = [];
  for (const relation of [...relations, ...fallbackRelations]) {
    const sourceItem = itemById.get(relation.sourceEventId);
    const targetItem = itemById.get(relation.targetEventId);
    if (!sourceItem || !targetItem) {
      continue;
    }

    const pathInfo = buildConnectorPath(
      sourceItem,
      targetItem,
      nodeBoundsById[sourceItem.event.id],
      nodeBoundsById[targetItem.event.id]
    );
    if (!pathInfo) {
      continue;
    }

    result.push({
      key: `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? (relation.isExplicit ? "explicit" : "sequence")}`,
      path: pathInfo.path,
      lane: targetItem.event.lane,
      cross: pathInfo.cross,
      sourceEventId: relation.sourceEventId,
      targetEventId: relation.targetEventId,
      sourceLane: sourceItem.event.lane,
      targetLane: targetItem.event.lane,
      isExplicit: relation.isExplicit,
      ...buildOptionalRelationFields(relation)
    });
  }

  return result;
}

export function buildTimelineRelations(
  events: readonly TimelineEvent[]
): readonly TimelineRelation[] {
  const eventIds = new Set(events.map((event) => event.id));
  const seen = new Set<string>();
  const relations: TimelineRelation[] = [];

  for (const event of events) {
    const parentEventId = extractMetadataString(event.metadata, "parentEventId");
    if (parentEventId && eventIds.has(parentEventId)) {
      const relationType = extractMetadataString(event.metadata, "relationType");
      const label = extractMetadataString(event.metadata, "relationLabel");
      const explanation = extractMetadataString(event.metadata, "relationExplanation");
      const workItemId = extractMetadataString(event.metadata, "workItemId");
      const goalId = extractMetadataString(event.metadata, "goalId");
      const planId = extractMetadataString(event.metadata, "planId");
      const handoffId = extractMetadataString(event.metadata, "handoffId");
      pushRelation(relations, seen, {
        sourceEventId: parentEventId,
        targetEventId: event.id,
        isExplicit: true,
        ...(relationType !== undefined ? { relationType } : {}),
        ...(label !== undefined ? { label } : {}),
        ...(explanation !== undefined ? { explanation } : {}),
        ...(workItemId !== undefined ? { workItemId } : {}),
        ...(goalId !== undefined ? { goalId } : {}),
        ...(planId !== undefined ? { planId } : {}),
        ...(handoffId !== undefined ? { handoffId } : {})
      });
    }

    for (const relatedEventId of extractMetadataStringArray(event.metadata, "relatedEventIds")) {
      if (!eventIds.has(relatedEventId)) {
        continue;
      }

      const relationType = extractMetadataString(event.metadata, "relationType");
      const label = extractMetadataString(event.metadata, "relationLabel");
      const explanation = extractMetadataString(event.metadata, "relationExplanation");
      const workItemId = extractMetadataString(event.metadata, "workItemId");
      const goalId = extractMetadataString(event.metadata, "goalId");
      const planId = extractMetadataString(event.metadata, "planId");
      const handoffId = extractMetadataString(event.metadata, "handoffId");
      pushRelation(relations, seen, {
        sourceEventId: relatedEventId,
        targetEventId: event.id,
        isExplicit: true,
        ...(relationType !== undefined ? { relationType } : {}),
        ...(label !== undefined ? { label } : {}),
        ...(explanation !== undefined ? { explanation } : {}),
        ...(workItemId !== undefined ? { workItemId } : {}),
        ...(goalId !== undefined ? { goalId } : {}),
        ...(planId !== undefined ? { planId } : {}),
        ...(handoffId !== undefined ? { handoffId } : {})
      });
    }
  }

  return relations;
}

/**
 * ISO 타임스탬프를 상대 시간 문자열로 변환.
 *
 * @example
 * formatRelativeTime("2026-03-17T10:00:00.000Z") // → "2m ago"
 *
 * @param value - ISO 8601 형식 타임스탬프 문자열
 * @returns "just now" | "Nm ago" | "Nh ago" | "Nd ago"
 */
export function formatRelativeTime(value: string): string {
  const delta = Date.now() - Date.parse(value);
  const minutes = Math.round(delta / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function getTimelineNodeBounds(
  item: TimelineItemLayout,
  measuredBounds?: TimelineNodeBounds
): {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
} {
  const left = measuredBounds?.left ?? item.left - NODE_WIDTH / 2;
  const top = measuredBounds?.top ?? item.top;
  const width = measuredBounds?.width ?? NODE_WIDTH;
  const height = measuredBounds?.height ?? NODE_HEIGHT;

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

function buildConnectorPath(
  sourceItem: TimelineItemLayout,
  targetItem: TimelineItemLayout,
  sourceBounds: TimelineNodeBounds | undefined,
  targetBounds: TimelineNodeBounds | undefined
): { readonly path: string; readonly cross: boolean } | null {
  const source = getTimelineNodeBounds(sourceItem, sourceBounds);
  const target = getTimelineNodeBounds(targetItem, targetBounds);
  const sameLane = sourceItem.event.lane === targetItem.event.lane;

  if (sameLane) {
    const x1 = source.right;
    const x2 = target.left;
    if (x2 - x1 < 8) {
      return null;
    }

    const y1 = source.centerY;
    const y2 = target.centerY;
    return {
      cross: false,
      path:
        Math.abs(y2 - y1) < 2
          ? `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate(x2)}`
          : `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate((x1 + x2) / 2)} V ${roundCoordinate(y2)} H ${roundCoordinate(x2)}`
    };
  }

  const movingDown = target.centerY >= source.centerY;
  const startX = source.centerX;
  const startY = movingDown ? source.bottom : source.top;
  const endX = target.centerX;
  const endY = movingDown ? target.top : target.bottom;

  return {
    cross: true,
    path:
      Math.abs(endX - startX) < 8
        ? `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate(endY)}`
        : `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate((startY + endY) / 2)} H ${roundCoordinate(endX)} V ${roundCoordinate(endY)}`
  };
}

function pushRelation(
  relations: TimelineRelation[],
  seen: Set<string>,
  relation: TimelineRelation
): void {
  const key = `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? "relates_to"}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  relations.push(relation);
}

function buildOptionalRelationFields(relation: TimelineRelation): {
  readonly relationType?: string;
  readonly label?: string;
  readonly explanation?: string;
  readonly workItemId?: string;
  readonly goalId?: string;
  readonly planId?: string;
  readonly handoffId?: string;
} {
  return {
    ...(relation.relationType !== undefined ? { relationType: relation.relationType } : {}),
    ...(relation.label !== undefined ? { label: relation.label } : {}),
    ...(relation.explanation !== undefined ? { explanation: relation.explanation } : {}),
    ...(relation.workItemId !== undefined ? { workItemId: relation.workItemId } : {}),
    ...(relation.goalId !== undefined ? { goalId: relation.goalId } : {}),
    ...(relation.planId !== undefined ? { planId: relation.planId } : {}),
    ...(relation.handoffId !== undefined ? { handoffId: relation.handoffId } : {})
  };
}

function extractMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function extractMetadataStringArray(
  metadata: Record<string, unknown>,
  key: string
): readonly string[] {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function roundCoordinate(value: number): number {
  return Math.round(value);
}
