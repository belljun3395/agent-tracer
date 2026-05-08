import type { PositionedNode } from "./lib/layout.js";
import type { FeedEdge } from "./lib/build-edges.js";
import { LANE_HEIGHT, LANE_LABEL_WIDTH } from "./lib/layout.js";

interface GraphEdgesProps {
  readonly edges: readonly FeedEdge[];
  readonly nodes: readonly PositionedNode[];
}

/**
 * SVG path layer drawn behind the nodes. Curves use the same (laneIdx,
 * leftPercent) coordinates the nodes sit on so paths land exactly on
 * each node's center.
 *
 * Path math: a horizontal cubic Bezier between (x1,y1) and (x2,y2) using
 * the midpoint x as the control x. This gives a gentle S-curve when
 * lanes differ and a near-straight line when they're equal — matches
 * the v6 mock's edge style.
 */
export function GraphEdges({ edges, nodes }: GraphEdgesProps) {
  if (edges.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      aria-hidden
      className="absolute pointer-events-none"
      preserveAspectRatio="none"
      style={{
        left: LANE_LABEL_WIDTH,
        right: 0,
        top: 0,
        bottom: 0,
        width: `calc(100% - ${LANE_LABEL_WIDTH}px)`,
        height: nodes.length > 0 ? "100%" : 0,
        zIndex: 1,
      }}
      viewBox="0 0 100 480"
    >
      {edges.map((edge, idx) => {
        const from = byId.get(edge.fromEventId);
        const to = byId.get(edge.toEventId);
        if (!from || !to) return null;
        const x1 = from.leftPercent;
        const y1 = laneCenterY(from.laneIdx);
        const x2 = to.leftPercent;
        const y2 = laneCenterY(to.laneIdx);
        const midX = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        const dashed = edge.kind === "explicit";
        return (
          <path
            key={`${edge.fromEventId}-${edge.toEventId}-${idx}`}
            d={d}
            fill="none"
            stroke="var(--ink-tertiary)"
            strokeWidth={1.4}
            strokeDasharray={dashed ? "3,3" : undefined}
            opacity={dashed ? 0.85 : 0.55}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

function laneCenterY(laneIdx: number): number {
  // Match LANE_HEIGHT × idx + LANE_HEIGHT/2 (in svg user units which are
  // mapped to the lane band height through preserveAspectRatio="none").
  return laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
}
