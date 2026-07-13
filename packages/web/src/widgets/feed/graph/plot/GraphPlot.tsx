import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { LaneKey } from "~web/entities/task/model/lane-theme.js";
import type { TimeRange } from "~web/widgets/feed/graph/model/time-range.js";
import type { FeedEdge } from "~web/widgets/feed/graph/model/edges.js";
import type { PositionedNode } from "~web/widgets/feed/graph/model/node-layout.js";
import { LANE_HEIGHT } from "~web/widgets/feed/graph/model/track-geometry.js";
import { CompactBand } from "~web/widgets/feed/graph/plot/CompactBand.js";
import { GraphEdges } from "~web/widgets/feed/graph/plot/GraphEdges.js";
import { GraphLanes } from "~web/widgets/feed/graph/plot/GraphLanes.js";
import { GraphNode } from "~web/widgets/feed/graph/plot/GraphNode.js";
import { NowMarker } from "~web/widgets/feed/graph/plot/NowMarker.js";

interface GraphPlotProps {
  readonly events: readonly TimelineEventRecord[];
  readonly range: TimeRange;
  readonly lanes: readonly LaneKey[];
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly FeedEdge[];
  readonly nowMs: number;
}

/** 레인·노드·엣지·시간 마커를 하나의 plot 좌표계에 그린다. */
export function GraphPlot({
  events,
  range,
  lanes,
  nodes,
  edges,
  nowMs,
}: GraphPlotProps) {
  return (
    <div className="relative" style={{ height: lanes.length * LANE_HEIGHT }}>
      <GraphLanes lanes={lanes} />
      <CompactBand events={events} range={range} />
      <GraphEdges
        edges={edges}
        nodes={nodes}
        visibleLaneCount={lanes.length}
      />
      {nodes.map((node) => (
        <GraphNode key={node.id} node={node} />
      ))}
      <NowMarker nowMs={nowMs} range={range} />
    </div>
  );
}
