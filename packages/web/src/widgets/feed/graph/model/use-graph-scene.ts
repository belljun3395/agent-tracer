import { useMemo, useState } from "react";
import type { TaskTurnSummary } from "~web/entities/task/model/task-query.js";
import type { TimelineEventRecord } from "~web/entities/task/model/timeline/event.js";
import { buildVerificationOverlay } from "~web/entities/task/model/timeline/verification-overlay.js";
import type { TaskVerification } from "~web/entities/task/model/timeline/verification.js";
import { useNowMs } from "~web/shared/lib/hooks/use-now-ms.js";
import { laneThemeForEvent } from "~web/entities/task/model/lane-theme.js";
import { useSelectedEventId, useVisibleLanes } from "~web/shared/store/index.js";
import { buildAxisTicks, type AxisTick } from "~web/widgets/feed/graph/model/axis-ticks.js";
import { filterGraphEdges } from "~web/widgets/feed/graph/model/edge-visibility.js";
import { buildFeedEdges, type FeedEdge } from "~web/widgets/feed/graph/model/edges.js";
import {
  GRAPH_LANE_KEYS,
  latestGraphNode,
  layoutGraphNodes,
  type GraphLaneKey,
  type PositionedNode,
} from "~web/widgets/feed/graph/model/node-layout.js";
import { axisEventsOf, buildTimeRange, type TimeRange } from "~web/widgets/feed/graph/model/time-range.js";

interface UseGraphSceneOptions {
  readonly events: readonly TimelineEventRecord[];
  readonly verifications: readonly TaskVerification[];
  readonly turns: readonly TaskTurnSummary[];
  readonly taskStatus?: "running" | "waiting" | "completed" | "errored";
}

export interface GraphScene {
  readonly nowMs: number;
  readonly range: TimeRange;
  readonly lanes: readonly GraphLaneKey[];
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly FeedEdge[];
  readonly ticks: readonly AxisTick[];
  readonly hideEmptyLanes: boolean;
  readonly hiddenEmptyCount: number;
  readonly toggleEmptyLanes: () => void;
  readonly selectedKey: string | null;
  readonly selectedLeftPercent: number | null;
  readonly latestLeftPercent: number | null;
}

/** 원시 이벤트와 화면 설정을 렌더 가능한 그래프 scene으로 투영한다. */
export function useGraphScene({
  events,
  verifications,
  turns,
  taskStatus,
}: UseGraphSceneOptions): GraphScene {
  const nowMs = useNowMs(15_000);
  const visibleLanes = useVisibleLanes();
  const selectedEventId = useSelectedEventId();
  const [hideEmptyLanes, setHideEmptyLanes] = useState(true);
  const freezeAtLastEvent = taskStatus !== undefined && taskStatus !== "running";
  const range = useMemo(
    () => buildTimeRange(axisEventsOf(events), nowMs, { freezeAtLastEvent }),
    [events, nowMs, freezeAtLastEvent],
  );
  const verificationOverlay = useMemo(
    () => buildVerificationOverlay(events, verifications),
    [events, verifications],
  );
  const filteredLanes = useMemo(
    () => GRAPH_LANE_KEYS.filter((key) => visibleLanes.includes(key as never)),
    [visibleLanes],
  );
  const populatedLanes = useMemo(() => {
    const populated = new Set<string>();
    for (const event of events) {
      const verification = verificationOverlay.get(event.id);
      populated.add(verification?.moveToVeri ? "veri" : laneThemeForEvent(event).key);
    }
    return populated;
  }, [events, verificationOverlay]);
  const lanes = useMemo(
    () =>
      hideEmptyLanes
        ? filteredLanes.filter((key) => populatedLanes.has(key))
        : filteredLanes,
    [filteredLanes, hideEmptyLanes, populatedLanes],
  );
  const nodes = useMemo(
    () => layoutGraphNodes(events, range, lanes, verificationOverlay),
    [events, range, lanes, verificationOverlay],
  );
  const visibleNodeIds = useMemo<ReadonlySet<string>>(
    () => new Set(nodes.map((node) => node.id)),
    [nodes],
  );
  const edges = useMemo(
    () => filterGraphEdges(buildFeedEdges(events, turns), nodes, visibleNodeIds),
    [events, turns, nodes, visibleNodeIds],
  );
  const ticks = useMemo(() => buildAxisTicks(range), [range]);
  const latestNode = useMemo(() => latestGraphNode(nodes), [nodes]);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.vm.event.id === selectedEventId),
    [nodes, selectedEventId],
  );

  return {
    nowMs,
    range,
    lanes,
    nodes,
    edges,
    ticks,
    hideEmptyLanes,
    hiddenEmptyCount: filteredLanes.length - lanes.length,
    toggleEmptyLanes: () => setHideEmptyLanes((value) => !value),
    selectedKey: selectedEventId,
    selectedLeftPercent: selectedNode?.leftPercent ?? null,
    latestLeftPercent: latestNode?.leftPercent ?? null,
  };
}
