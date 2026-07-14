import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import {
  classifyEvent,
  type ActVm,
} from "~web/widgets/feed/lib/timeline/act-classification.js";
import {
  laneThemeForKey,
  type LaneKey,
} from "~web/entities/task/model/lane-theme.js";
import { msToLeftPercent, type TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import type { VerificationOverlayEntry } from "~web/entities/task/model/timeline/verification-overlay.js";

/** 그래프가 위에서 아래로 표시하는 레인 순서. */
export const GRAPH_LANE_KEYS = [
  "user",
  "asst",
  "plan",
  "expl",
  "impl",
  "rule",
  "veri",
  "coord",
] as const satisfies readonly LaneKey[];

export type GraphLaneKey = (typeof GRAPH_LANE_KEYS)[number];

const COLLISION_THRESHOLD_PERCENT = 1.5;

const STAGGER_OFFSETS = [0, 14, -14, 22, -22, 8, -8] as const;

export interface PositionedNode {
  readonly id: string;
  readonly leftPercent: number;
  readonly laneIdx: number;
  readonly vm: ActVm;
  /** 레인 중앙 기준 세로 오프셋(px). */
  readonly yOffset: number;
  /** 밀집 노드 렌더링이 필요하면 true. */
  readonly dense: boolean;
  readonly verification?: VerificationOverlayEntry;
}

/** 이벤트를 그래프 레인과 시간축 좌표로 투영한다. */
export function layoutGraphNodes(
  events: readonly TimelineEventRecord[],
  range: TimeRange,
  laneKeys: readonly LaneKey[] = GRAPH_LANE_KEYS,
  verificationOverlay: ReadonlyMap<string, VerificationOverlayEntry> = new Map(),
): readonly PositionedNode[] {
  const draft: Array<{
    id: string;
    leftPercent: number;
    laneIdx: number;
    vm: ActVm;
    timeMs: number;
    verification?: VerificationOverlayEntry;
  }> = [];
  for (const event of events) {
    const verification = verificationOverlay.get(event.id);
    const baseVm = classifyEvent(event, range.minMs);
    const vm = verification?.moveToVeri
      ? { ...baseVm, lane: laneThemeForKey("veri") }
      : baseVm;
    const laneIdx = laneKeys.indexOf(vm.lane.key);
    if (laneIdx < 0) continue;
    const timeMs = Date.parse(event.createdAt);
    draft.push({
      id: event.id,
      leftPercent: msToLeftPercent(timeMs, range),
      laneIdx,
      vm,
      timeMs,
      ...(verification ? { verification } : {}),
    });
  }

  const offsetsById = new Map<string, number>();
  const denseById = new Map<string, boolean>();
  const byLane = new Map<number, typeof draft>();
  for (const node of draft) {
    let bucket = byLane.get(node.laneIdx);
    if (!bucket) {
      bucket = [];
      byLane.set(node.laneIdx, bucket);
    }
    bucket.push(node);
  }
  for (const laneNodes of byLane.values()) {
    laneNodes.sort((a, b) => a.timeMs - b.timeMs);
    let clusterIndex = 0;
    let lastPercent = -Infinity;
    for (let i = 0; i < laneNodes.length; i++) {
      const node = laneNodes[i]!;
      if (node.leftPercent - lastPercent < COLLISION_THRESHOLD_PERCENT) {
        clusterIndex += 1;
      } else {
        clusterIndex = 0;
      }
      const offset =
        STAGGER_OFFSETS[clusterIndex % STAGGER_OFFSETS.length] ?? 0;
      offsetsById.set(node.id, offset);

      const closeToPrev =
        i > 0 &&
        node.leftPercent - laneNodes[i - 1]!.leftPercent <
          COLLISION_THRESHOLD_PERCENT;
      const closeToNext =
        i < laneNodes.length - 1 &&
        laneNodes[i + 1]!.leftPercent - node.leftPercent <
          COLLISION_THRESHOLD_PERCENT;
      denseById.set(node.id, closeToPrev || closeToNext);

      lastPercent = node.leftPercent;
    }
  }

  return draft.map((d) => ({
    id: d.id,
    leftPercent: d.leftPercent,
    laneIdx: d.laneIdx,
    vm: d.vm,
    yOffset: offsetsById.get(d.id) ?? 0,
    dense: denseById.get(d.id) ?? false,
    ...(d.verification ? { verification: d.verification } : {}),
  }));
}

export function latestGraphNode(
  nodes: readonly PositionedNode[],
): PositionedNode | undefined {
  return nodes.reduce<PositionedNode | undefined>((latest, node) => {
    if (!latest) return node;
    return Date.parse(node.vm.event.createdAt) >= Date.parse(latest.vm.event.createdAt)
      ? node
      : latest;
  }, undefined);
}
