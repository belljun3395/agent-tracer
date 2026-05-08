import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import { useSelectedEventId, useVisibleLanes } from "~state/ui/index.js";
import { useNowMs } from "~state/ui/useNowMs.js";
import { GraphLanes } from "./GraphLanes.js";
import { GraphAxis } from "./GraphAxis.js";
import { GraphNode } from "./GraphNode.js";
import { GraphEdges } from "./GraphEdges.js";
import { NowMarker } from "./NowMarker.js";
import { CompactBand } from "./CompactBand.js";
import { GraphLegend } from "./GraphLegend.js";
import {
  GRAPH_LANE_KEYS,
  LANE_HEIGHT,
  LANE_LABEL_WIDTH,
  layoutGraphNodes,
} from "./lib/layout.js";
import { buildTimeRange } from "./lib/time-range.js";
import { buildAxisTicks } from "./lib/ticks.js";
import { buildFeedEdges } from "./lib/build-edges.js";

interface GraphViewProps {
  readonly events: readonly TimelineEventRecord[];
  readonly turns?: readonly TaskTurnSummary[];
  /**
   * Task lifecycle status. When the task is no longer producing events
   * (completed / errored / waiting), the time axis stops extending to
   * `nowMs` so the graph stops drifting leftward on every clock tick.
   */
  readonly taskStatus?: "running" | "waiting" | "completed" | "errored";
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const DEFAULT_ZOOM = 8;
const WHEEL_SENSITIVITY = 0.0015;

/**
 * Swimlane SVG-style projection of the feed.
 *
 * Interaction:
 *   • wheel  — zoom in/out, anchored at cursor x
 *   • drag   — horizontal pan when zoomed (cursor changes to grabbing)
 *   • mount  — auto-scrolls to the right edge so the latest event +
 *               NOW marker are visible without the operator hunting
 *
 * The zoom/pan story matters because once a task accumulates 100s of
 * events spread across hours, the unzoomed view crushes them onto a
 * single column. Zoom expands the time axis; pan navigates the wider
 * canvas. Selection (clicking nodes) is unchanged — same UI store as
 * the feed.
 */
export function GraphView({ events, turns = [], taskStatus }: GraphViewProps) {
  const nowMs = useNowMs(15_000);
  const freezeAtLastEvent = taskStatus !== undefined && taskStatus !== "running";
  const range = useMemo(
    () => buildTimeRange(events, nowMs, { freezeAtLastEvent }),
    [events, nowMs, freezeAtLastEvent],
  );
  const visibleLanes = useVisibleLanes();
  const visibleLaneSet = useMemo<ReadonlySet<string>>(
    () => new Set(visibleLanes),
    [visibleLanes],
  );
  const allNodes = useMemo(() => layoutGraphNodes(events, range), [events, range]);
  // Lane-filter the nodes; edges drop with both endpoints hidden so we
  // never render a dangling line into empty space.
  const nodes = useMemo(
    () => allNodes.filter((n) => visibleLaneSet.has(n.vm.lane.key)),
    [allNodes, visibleLaneSet],
  );
  const visibleNodeIds = useMemo<ReadonlySet<string>>(
    () => new Set(nodes.map((n) => n.vm.event.id as unknown as string)),
    [nodes],
  );
  const ticks = useMemo(() => buildAxisTicks(range), [range]);
  const edges = useMemo(() => {
    const all = buildFeedEdges(events, turns);
    return all.filter(
      (e) => visibleNodeIds.has(e.fromEventId) && visibleNodeIds.has(e.toEventId),
    );
  }, [events, turns, visibleNodeIds]);

  const selectedEventId = useSelectedEventId();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Default zoom = 8× because at lower zoom labels collide. The tradeoff:
  // operators see only a window into the full timeline by default, but
  // each visible node carries enough detail to reason about. Drag-pan
  // and zoom-out are always one gesture away.
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const dragStateRef = useRef<{
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const lastEventCountRef = useRef(0);

  // Auto-focus to the latest *node*, not to the canvas right edge. The
  // canvas extends to `nowMs`, but if the freshest event happened a
  // while ago there's a gap of empty timeline between it and the right
  // edge — pinning to scrollWidth at zoom 8× would park the operator
  // in that empty gap with no nodes visible. We center on the latest
  // node's leftPercent instead.
  const focusOnNode = (leftPercent: number) => {
    const node = scrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      const inner = node.firstElementChild as HTMLElement | null;
      const innerWidth = inner?.scrollWidth ?? node.scrollWidth;
      // Account for the sticky lane-label gutter — the time axis only
      // occupies (innerWidth - LANE_LABEL_WIDTH).
      const trackWidth = innerWidth - LANE_LABEL_WIDTH;
      const targetX = LANE_LABEL_WIDTH + trackWidth * (leftPercent / 100);
      const viewport = node.clientWidth;
      // Center the node when possible; clamp to valid scroll range so
      // we don't overshoot at the edges.
      const desired = targetX - viewport / 2;
      const max = innerWidth - viewport;
      node.scrollLeft = Math.max(0, Math.min(desired, max));
    });
  };

  useEffect(() => {
    if (events.length === 0) return;
    if (events.length === lastEventCountRef.current) return;
    lastEventCountRef.current = events.length;
    const last = nodes[nodes.length - 1];
    if (!last) return;
    focusOnNode(last.leftPercent);
  }, [events.length, nodes]);

  // Re-pin to the latest node when zoom changes too — so zooming in
  // doesn't strand the viewport in an empty region.
  useEffect(() => {
    const last = nodes[nodes.length - 1];
    if (!last) return;
    focusOnNode(last.leftPercent);
  }, [zoom, nodes]);

  // Auto-focus on selection: when an event is picked elsewhere (e.g.
  // the Trace tab), pull its node into the centre of the viewport.
  useEffect(() => {
    if (!selectedEventId) return;
    const target = nodes.find((n) => n.vm.event.id === selectedEventId);
    if (!target) return;
    focusOnNode(target.leftPercent);
  }, [selectedEventId, nodes]);

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey && event.deltaY === 0) return;
    // Hold cmd/ctrl to zoom (matches Figma / Linear conventions).
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const node = scrollRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cursorX = event.clientX - rect.left + node.scrollLeft;
      const prevZoom = zoom;
      const next = clamp(zoom * (1 - event.deltaY * WHEEL_SENSITIVITY), MIN_ZOOM, MAX_ZOOM);
      if (next === prevZoom) return;
      setZoom(next);
      // Anchor zoom at cursor — recompute scroll so the cursor's data
      // point stays under the cursor.
      const ratio = next / prevZoom;
      requestAnimationFrame(() => {
        node.scrollLeft = cursorX * ratio - (event.clientX - rect.left);
      });
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Only drag-pan with left button on the empty canvas (not on nodes).
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return; // node click — let it through
    const node = scrollRef.current;
    if (!node) return;
    node.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      startX: event.clientX,
      startScrollLeft: node.scrollLeft,
    };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const node = scrollRef.current;
    if (!drag || !node) return;
    const delta = event.clientX - drag.startX;
    node.scrollLeft = drag.startScrollLeft - delta;
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current;
    if (node?.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
  };

  const lanesHeight = GRAPH_LANE_KEYS.length * LANE_HEIGHT;

  return (
    <div className="px-9 pb-6">
      <div
        className="rounded-[var(--radius-md)]"
        style={{
          background: "var(--s1)",
          border: "1px solid var(--hair)",
          overflow: "hidden",
        }}
      >
        <div
          ref={scrollRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            cursor: dragStateRef.current ? "grabbing" : "grab",
            position: "relative",
          }}
        >
          {/* Inner canvas grows with zoom; outer container scrolls. */}
          <div
            style={{
              width: `${zoom * 100}%`,
              minWidth: "100%",
              position: "relative",
            }}
          >
            <div className="relative" style={{ height: lanesHeight }}>
              <GraphLanes />
              <CompactBand events={events} range={range} />
              <GraphEdges edges={edges} nodes={nodes} />
              {nodes.map((node) => (
                <GraphNode key={node.id} node={node} />
              ))}
              <NowMarker nowMs={nowMs} range={range} />
            </div>
            <GraphAxis ticks={ticks} leftOffset={LANE_LABEL_WIDTH} />
          </div>
        </div>
        <GraphLegend />
        <ZoomControls zoom={zoom} onZoom={setZoom} />
      </div>
    </div>
  );
}

interface ZoomControlsProps {
  readonly zoom: number;
  readonly onZoom: (next: number) => void;
}

function ZoomControls({ zoom, onZoom }: ZoomControlsProps) {
  const setClamped = (next: number) => onZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderTop: "1px solid var(--hair)",
        background: "var(--canvas)",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--ink-tertiary)",
      }}
    >
      <span>zoom</span>
      <button
        type="button"
        onClick={() => setClamped(zoom / 1.5)}
        aria-label="Zoom out"
        style={zoomBtnStyle}
        disabled={zoom <= MIN_ZOOM}
      >
        −
      </button>
      <span style={{ minWidth: 36, textAlign: "center", color: "var(--ink-muted)" }}>
        {zoom.toFixed(1)}×
      </span>
      <button
        type="button"
        onClick={() => setClamped(zoom * 1.5)}
        aria-label="Zoom in"
        style={zoomBtnStyle}
        disabled={zoom >= MAX_ZOOM}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => onZoom(DEFAULT_ZOOM)}
        style={{ ...zoomBtnStyle, width: "auto", padding: "0 8px" }}
        disabled={zoom === DEFAULT_ZOOM}
      >
        reset
      </button>
      <span style={{ marginLeft: "auto" }}>
        ⌘+wheel to zoom · drag to pan
      </span>
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  height: 22,
  width: 22,
  border: "1px solid var(--hair)",
  borderRadius: "var(--radius-xs)",
  background: "var(--s1)",
  color: "var(--ink-muted)",
  cursor: "pointer",
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
