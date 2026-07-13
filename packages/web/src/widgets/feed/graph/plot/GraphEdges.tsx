import type { FeedEdge } from "~web/widgets/feed/graph/model/edges.js";
import type { PositionedNode } from "~web/widgets/feed/graph/model/node-layout.js";
import {
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  TRACK_LEFT_PADDING,
  laneCenterY,
} from "~web/widgets/feed/graph/model/track-geometry.js";

interface GraphEdgesProps {
  readonly edges: readonly FeedEdge[];
  readonly nodes: readonly PositionedNode[];
  /** 보이는 레인 수. */
  readonly visibleLaneCount: number;
}

/** 노드 뒤에 그려지는 SVG path 레이어. */
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
        // 명시적 엣지(메타데이터로 선언된 parent)는 핵심 인과 신호이므로 끝에 원을 붙여 두드러지게 그린다.
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
