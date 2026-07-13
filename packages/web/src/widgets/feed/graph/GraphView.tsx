import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import { GraphContextStrip } from "~web/widgets/feed/graph/context/GraphContextStrip.js";
import { GraphControls } from "~web/widgets/feed/graph/controls/GraphControls.js";
import { GraphLegend } from "~web/widgets/feed/graph/controls/GraphLegend.js";
import { useGraphScene } from "~web/widgets/feed/graph/model/use-graph-scene.js";
import { GraphAxis } from "~web/widgets/feed/graph/plot/GraphAxis.js";
import { GraphPlot } from "~web/widgets/feed/graph/plot/GraphPlot.js";
import {
  LANE_LABEL_WIDTH,
  TRACK_LEFT_PADDING,
} from "~web/widgets/feed/graph/model/track-geometry.js";
import { GraphViewport } from "~web/widgets/feed/graph/viewport/GraphViewport.js";
import { useGraphViewport } from "~web/widgets/feed/graph/viewport/use-graph-viewport.js";

interface GraphViewProps {
  readonly events: readonly TimelineEventRecord[];
  readonly verifications: readonly TaskVerification[];
  readonly turns?: readonly TaskTurnSummary[];
  readonly taskStatus?: "running" | "waiting" | "completed" | "errored";
}

/** 그래프 scene, viewport, plot, context와 controls를 조립한다. */
export function GraphView({
  events,
  verifications,
  turns = [],
  taskStatus,
}: GraphViewProps) {
  const scene = useGraphScene({
    events,
    verifications,
    turns,
    ...(taskStatus ? { taskStatus } : {}),
  });
  const viewport = useGraphViewport({
    itemCount: events.length,
    latestLeftPercent: scene.latestLeftPercent,
    selectedKey: scene.selectedKey,
    selectedLeftPercent: scene.selectedLeftPercent,
  });

  return (
    <div className="px-9 pb-6">
      <div className="rounded-md bg-s1 border border-hair overflow-hidden">
        <GraphViewport binding={viewport.binding}>
          <GraphPlot
            events={events}
            range={scene.range}
            lanes={scene.lanes}
            nodes={scene.nodes}
            edges={scene.edges}
            nowMs={scene.nowMs}
          />
          <GraphContextStrip events={events} range={scene.range} />
          <GraphAxis
            ticks={scene.ticks}
            leftOffset={LANE_LABEL_WIDTH + TRACK_LEFT_PADDING}
          />
        </GraphViewport>
        <GraphLegend />
        <GraphControls
          zoom={viewport.binding.zoom}
          onZoom={viewport.setZoom}
          hideEmptyLanes={scene.hideEmptyLanes}
          onToggleEmptyLanes={scene.toggleEmptyLanes}
          hiddenEmptyCount={scene.hiddenEmptyCount}
        />
      </div>
    </div>
  );
}
