/**
 * @module timeline
 *
 * 타임라인 레이아웃 계산 유틸리티.
 * 이벤트 좌표 계산, 연결선 경로 생성, 타임스탬프 눈금, 상대 시간 변환을 담당.
 */

import type { TimelineEvent, TimelineLane } from "../types.js";

/** 타임라인 캔버스에서 이벤트 노드 한 항목의 레이아웃 정보. */
export interface TimelineItemLayout {
  readonly event: TimelineEvent;
  readonly left: number;
  readonly top: number;
}

/** 전체 타임라인 캔버스 레이아웃: 너비, "now" 선 위치, 항목 배열. */
export interface TimelineLayout {
  readonly width: number;
  readonly nowLeft: number;
  readonly items: readonly TimelineItemLayout[];
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
}

/** 타임라인에 표시되는 5개 레인 순서. */
export const TIMELINE_LANES: readonly TimelineLane[] = [
  "user",
  "exploration",
  "planning",
  "implementation",
  "rules"
];

/** 레인 한 행의 픽셀 높이. */
export const LANE_HEIGHT   = 112;
/** 타임스탬프 눈금 영역 높이. */
export const RULER_HEIGHT  = 32;
/** 이벤트 노드 카드 너비 (CSS .event-node width와 일치해야 함). */
export const NODE_WIDTH    = 152;
/** 이벤트 카드 대략적 렌더링 높이. */
export const NODE_HEIGHT   = 76;
/** 레인 라벨 영역 너비. */
export const LEFT_GUTTER = 176;
const CLUSTER_STAGGER = NODE_WIDTH + 8; // px shift between stacked same-lane same-time nodes

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
  nowMs: number = Date.now()
): TimelineLayout {
  if (events.length === 0) {
    return {
      width: 1200,
      nowLeft: 1200 - 32,
      items: []
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
  const usableTrack = Math.max(1, trackWidth - NODE_HALF * 2);

  const nowLeft = trackStart + Math.round(((nowMs - min) / span) * usableTrack);

  // Base positions
  const rawItems = events.map((event) => {
    const laneIndex = TIMELINE_LANES.indexOf(event.lane);
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
    if (!byLane.has(key)) byLane.set(key, []);
    byLane.get(key)!.push(item);
  }

  const adjusted = new Map<TimelineEvent, number>(); // event → adjusted left

  for (const laneItems of byLane.values()) {
    const sorted = [...laneItems].sort((a, b) => a.left - b.left);
    let i = 0;
    while (i < sorted.length) {
      // Collect cluster: all items within NODE_WIDTH of sorted[i].left
      const anchor = sorted[i]!.left;
      const cluster: typeof sorted = [];
      while (i < sorted.length && sorted[i]!.left - anchor < NODE_WIDTH) {
        cluster.push(sorted[i]!);
        i++;
      }
      if (cluster.length === 1) continue; // no overlap, keep original
      // Spread cluster: center around anchor
      const total = (cluster.length - 1) * CLUSTER_STAGGER;
      cluster.forEach((item, idx) => {
        adjusted.set(item.event, anchor - total / 2 + idx * CLUSTER_STAGGER);
      });
    }
  }

  const items = rawItems.map((item) =>
    adjusted.has(item.event)
      ? { ...item, left: Math.round(adjusted.get(item.event)!) }
      : item
  );

  return { width: contentWidth, nowLeft, items };
}

/** 타임라인 시간축 눈금 한 항목: 픽셀 x 위치와 레이블 문자열. */
export interface TimestampTick {
  readonly x: number;
  readonly label: string;
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
  const sorted = [...items].sort((a, b) => {
    const dt = Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
    if (dt !== 0) return dt;

    const laneOrder =
      TIMELINE_LANES.indexOf(a.event.lane) - TIMELINE_LANES.indexOf(b.event.lane);
    if (laneOrder !== 0) return laneOrder;

    return a.left - b.left;
  });

  const result: TimelineConnector[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const item = sorted[i]!;
    const next = sorted[i + 1]!;
    const source = getTimelineNodeBounds(item, nodeBoundsById[item.event.id]);
    const target = getTimelineNodeBounds(next, nodeBoundsById[next.event.id]);
    const sameLane = item.event.lane === next.event.lane;

    if (sameLane) {
      const x1 = source.right;
      const x2 = target.left;
      if (x2 - x1 < 8) continue;

      const y1 = source.centerY;
      const y2 = target.centerY;
      const path =
        Math.abs(y2 - y1) < 2
          ? `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate(x2)}`
          : `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate((x1 + x2) / 2)} V ${roundCoordinate(y2)} H ${roundCoordinate(x2)}`;

      result.push({
        key: `${item.event.id}→${next.event.id}`,
        path,
        lane: item.event.lane,
        cross: false,
        sourceEventId: item.event.id,
        targetEventId: next.event.id
      });
      continue;
    }

    const movingDown = target.centerY >= source.centerY;
    const startX = source.centerX;
    const startY = movingDown ? source.bottom : source.top;
    const endX = target.centerX;
    const endY = movingDown ? target.top : target.bottom;

    const path =
      Math.abs(endX - startX) < 8
        ? `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate(endY)}`
        : `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate((startY + endY) / 2)} H ${roundCoordinate(endX)} V ${roundCoordinate(endY)}`;

    result.push({
      key: `${item.event.id}→${next.event.id}`,
      path,
      lane: item.event.lane,
      cross: true,
      sourceEventId: item.event.id,
      targetEventId: next.event.id
    });
  }

  return result;
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

function roundCoordinate(value: number): number {
  return Math.round(value);
}
