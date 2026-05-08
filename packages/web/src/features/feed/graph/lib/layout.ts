import type { TimelineEventRecord } from "~domain/monitoring.js";
import {
  classifyEvent,
  type ActVm,
} from "~features/feed/lib/act-classification.js";
import type { LaneKey } from "~features/feed/lib/lane-theme.js";
import { msToLeftPercent, type TimeRange } from "./time-range.js";

/**
 * Lane order on the graph — top-to-bottom. `bg` is omitted from the graph
 * (telemetry / background events would clutter the swimlane without
 * adding diagnostic value).
 */
export const GRAPH_LANE_KEYS: readonly LaneKey[] = [
  "user",
  "plan",
  "expl",
  "impl",
  "rule",
  "veri",
  "coord",
];

export const LANE_HEIGHT = 60;
export const AXIS_HEIGHT = 28;
export const LANE_LABEL_WIDTH = 90;

/** Two nodes within this horizontal % of each other on the same lane are
 * considered colliding and get vertical stagger applied. Calibrated so
 * that at default zoom, 14px node circles don't overlap. */
const COLLISION_THRESHOLD_PERCENT = 1.5;

/**
 * Vertical pixel offsets cycled through within a collision cluster. Lane
 * is 60px tall; ±22 stays inside the band cleanly. Order alternates so
 * the first colliding pair sits above/below center, easier to scan than
 * a one-direction stack.
 */
const STAGGER_OFFSETS = [0, 14, -14, 22, -22, 8, -8] as const;

export interface PositionedNode {
  readonly id: string;
  readonly leftPercent: number;
  readonly laneIdx: number;
  readonly vm: ActVm;
  /** Pixel offset from lane center — 0 for non-colliding, ±N for clusters. */
  readonly yOffset: number;
  /**
   * True when this node has a neighbour within COLLISION_THRESHOLD_PERCENT
   * on either side. Renderers use this to hide labels-by-default in
   * dense clusters (so labels don't overlap), revealing them on
   * hover/focus instead.
   */
  readonly dense: boolean;
}

/**
 * Project events into (laneIdx, leftPercent) space for SVG / absolute
 * positioning. Events on hidden lanes (currently `bg`) are dropped.
 *
 * Collision avoidance: when two nodes on the same lane sit within
 * COLLISION_THRESHOLD_PERCENT of each other along x, the later one gets
 * a vertical offset so both circles stay readable. Without this, dense
 * task runs render as a single dot per cluster regardless of how many
 * events actually happened there.
 */
export function layoutGraphNodes(
  events: readonly TimelineEventRecord[],
  range: TimeRange,
): readonly PositionedNode[] {
  // 1. Initial positioning + lane filtering.
  const draft: Array<{
    id: string;
    leftPercent: number;
    laneIdx: number;
    vm: ActVm;
    timeMs: number;
  }> = [];
  for (const event of events) {
    const vm = classifyEvent(event, range.minMs);
    const laneIdx = GRAPH_LANE_KEYS.indexOf(vm.lane.key);
    if (laneIdx < 0) continue;
    const timeMs = Date.parse(event.createdAt);
    draft.push({
      id: event.id,
      leftPercent: msToLeftPercent(timeMs, range),
      laneIdx,
      vm,
      timeMs,
    });
  }

  // 2. Group by lane → sort each group by time → assign yOffset based on
  //    how many neighbours we've crowded against, plus mark `dense` for
  //    nodes that have any neighbour within the collision threshold.
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

      // Bidirectional density check — a node is dense if its prev OR
      // next neighbour is within threshold. Single-tick chains get
      // marked dense for every node, which is the right call for
      // "labels would overlap here".
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

  // 3. Materialise final readonly nodes in original order.
  return draft.map((d) => ({
    id: d.id,
    leftPercent: d.leftPercent,
    laneIdx: d.laneIdx,
    vm: d.vm,
    yOffset: offsetsById.get(d.id) ?? 0,
    dense: denseById.get(d.id) ?? false,
  }));
}

/** Vertical center (px) of the lane row at the given index. */
export function laneCenterY(laneIdx: number): number {
  return laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
}
