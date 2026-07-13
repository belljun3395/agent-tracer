import type { FeedEdge } from "~web/widgets/feed/graph/model/edges.js";
import { LANE_HEIGHT } from "~web/widgets/feed/graph/model/track-geometry.js";

const CAUSAL_MAX_X_SPAN = 20;
const MIN_EDGE_Y_PIXELS = 30;

export interface GraphEdgeNode {
  readonly id: string;
  readonly leftPercent: number;
  readonly laneIdx: number;
  readonly yOffset: number;
}

/** 가시 노드 사이에서 읽을 수 있는 교차 레인 엣지만 남긴다. */
export function filterGraphEdges(
  edges: readonly FeedEdge[],
  nodes: readonly GraphEdgeNode[],
  visibleNodeIds: ReadonlySet<string>,
): readonly FeedEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => {
    if (!visibleNodeIds.has(edge.fromEventId)) return false;
    if (!visibleNodeIds.has(edge.toEventId)) return false;
    const from = byId.get(edge.fromEventId);
    const to = byId.get(edge.toEventId);
    if (!from || !to || from.laneIdx === to.laneIdx) return false;
    const fromY = from.laneIdx * LANE_HEIGHT + from.yOffset;
    const toY = to.laneIdx * LANE_HEIGHT + to.yOffset;
    if (Math.abs(fromY - toY) < MIN_EDGE_Y_PIXELS) return false;
    return (
      edge.kind !== "causal" ||
      Math.abs(from.leftPercent - to.leftPercent) <= CAUSAL_MAX_X_SPAN
    );
  });
}
