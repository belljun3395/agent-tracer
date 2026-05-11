import type { PositionedNode } from "./lib/layout.js";
import type { FeedEdge } from "./lib/build-edges.js";
import {
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  TRACK_LEFT_PADDING,
  laneCenterY,
} from "./lib/layout.js";

interface GraphEdgesProps {
  readonly edges: readonly FeedEdge[];
  readonly nodes: readonly PositionedNode[];
  /**
   * Visible lane count — drives the SVG viewBox height so y coordinates
   * (returned by `laneCenterY`, in lane-pixel units) line up with the
   * absolutely-positioned node DOM. Without this the SVG used a fixed
   * viewBox y of 480 and `preserveAspectRatio="none"` compressed every
   * y coordinate by `actualHeight / 480` — edges then dangled in empty
   * space instead of touching their target node.
   */
  readonly visibleLaneCount: number;
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
 *
 * Visual treatment:
 *   - stroke `var(--ink-muted)` (not `--ink-tertiary`) for stronger
 *     contrast against the lane row dividers
 *   - small terminal disc at the `to` end so the edge clearly anchors
 *     to its target — without it, vertical edges through an empty lane
 *     read as dangling threads instead of connections
 */
export function GraphEdges({
  edges,
  nodes,
  visibleLaneCount,
}: GraphEdgesProps) {
  if (edges.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const viewBoxHeight = Math.max(1, visibleLaneCount * LANE_HEIGHT);

  return (
    <svg
      aria-hidden
      className="absolute pointer-events-none"
      preserveAspectRatio="none"
      style={{
        left: LANE_LABEL_WIDTH + TRACK_LEFT_PADDING,
        right: 0,
        top: 0,
        bottom: 0,
        width: `calc(100% - ${LANE_LABEL_WIDTH + TRACK_LEFT_PADDING}px)`,
        height: nodes.length > 0 ? "100%" : 0,
        zIndex: 1,
      }}
      viewBox={`0 0 100 ${viewBoxHeight}`}
    >
      {edges.map((edge, idx) => {
        const from = byId.get(edge.fromEventId);
        const to = byId.get(edge.toEventId);
        if (!from || !to) return null;
        const x1 = from.leftPercent;
        const y1 = laneCenterY(from.laneIdx) + from.yOffset;
        const x2 = to.leftPercent;
        const y2 = laneCenterY(to.laneIdx) + to.yOffset;
        const midX = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        const isExplicit = edge.kind === "explicit";
        // Explicit edges (metadata-declared parents) carry the load-bearing
        // causality signal — render them prominently with a terminal disc.
        // Cross-lane causals are kept as background hints: light, no marker,
        // dashed; they support the eye without competing with the nodes.
        return (
          <g key={`${edge.fromEventId}-${edge.toEventId}-${idx}`}>
            <path
              d={d}
              fill="none"
              stroke={isExplicit ? "var(--ink-muted)" : "var(--ink-tertiary)"}
              strokeWidth={isExplicit ? 1.4 : 1}
              strokeLinecap="round"
              strokeDasharray={isExplicit ? undefined : "3,4"}
              opacity={isExplicit ? 0.85 : 0.4}
              vectorEffect="non-scaling-stroke"
            />
            {isExplicit && (
              <circle
                cx={x2}
                cy={y2}
                r={1.8}
                fill="var(--ink-muted)"
                opacity={0.9}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

