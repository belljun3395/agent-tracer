/**
 * 5-레인 타임라인 캔버스.
 * 이벤트 노드, 연결선, 타임스탬프 눈금 렌더링.
 * 수평 스크롤, 줌(0.5x~5x), 레인 토글 지원.
 * 태스크 제목 편집 기능 포함.
 */

import type React from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent as ReactFormEvent
} from "react";

import {
  LANE_HEIGHT,
  NODE_WIDTH,
  RULER_HEIGHT,
  TIMELINE_LANES,
  buildTimelineConnectors,
  buildTimelineLayout,
  buildTimestampTicks,
  formatRelativeTime
} from "../lib/timeline.js";
import { filterTimelineEvents } from "../lib/insights.js";
import type { TimelineItemLayout, TimelineNodeBounds } from "../lib/timeline.js";
import type { TimelineEvent, TimelineLane } from "../types.js";

const laneLabels: Record<TimelineLane, string> = {
  user:           "User",
  exploration:    "Exploration",
  planning:       "Planning",
  implementation: "Implementation",
  rules:          "Rules"
};

const laneIcons: Record<TimelineLane, string> = {
  user:           "/icons/message.svg",
  exploration:    "/icons/file.svg",
  planning:       "/icons/thought.svg",
  implementation: "/icons/tool.svg",
  rules:          "/icons/terminal.svg"
};

const laneDescriptions: Record<TimelineLane, string> = {
  user:           "User instructions & task boundaries",
  exploration:    "File reads, searches, dependency checks",
  planning:       "Analysis, approach decisions, thinking",
  implementation: "Code edits, writes, file changes",
  rules:          "Tests, builds, lints, rule verifications"
};

const CANVAS_HEIGHT = RULER_HEIGHT + TIMELINE_LANES.length * LANE_HEIGHT;

interface NodeBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function areNodeBoundsEqual(
  current: Readonly<Record<string, NodeBounds>>,
  next: Readonly<Record<string, NodeBounds>>
): boolean {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  for (const key of nextKeys) {
    const currentBounds = current[key];
    const nextBounds = next[key];

    if (!currentBounds || !nextBounds) {
      return false;
    }

    if (
      Math.abs(currentBounds.left - nextBounds.left) > 0.5 ||
      Math.abs(currentBounds.top - nextBounds.top) > 0.5 ||
      Math.abs(currentBounds.width - nextBounds.width) > 0.5 ||
      Math.abs(currentBounds.height - nextBounds.height) > 0.5
    ) {
      return false;
    }
  }

  return true;
}

function MiniMap({
  items, canvasWidth
}: {
  readonly items: readonly TimelineItemLayout[];
  readonly canvasWidth: number;
}): React.JSX.Element {
  const W = 200;
  const H = 72;
  const scale = W / canvasWidth;

  return (
    <div className="minimap">
      <svg width={W} height={H} xmlns="http://www.w3.org/2000/svg">
        {TIMELINE_LANES.map((lane, laneIdx) => {
          const y = (laneIdx / TIMELINE_LANES.length) * H;
          const rowH = H / TIMELINE_LANES.length - 1;
          return (
            <g key={lane}>
              <rect x="0" y={y} width={W} height={rowH}
                className={`minimap-lane-bg ${lane}`} />
              {items
                .filter((item) => item.event.lane === lane)
                .map((item) => (
                  <rect
                    key={item.event.id}
                    x={item.left * scale - 2}
                    y={y + 2}
                    width={4}
                    height={rowH - 4}
                    className={`minimap-dot ${lane}`}
                    rx="1"
                  />
                ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface TimelineProps {
  readonly timeline: readonly TimelineEvent[];
  readonly taskTitle: string | null;
  readonly taskWorkspacePath?: string | undefined;
  readonly taskStatus?: "running" | "completed" | "errored" | undefined;
  readonly taskUpdatedAt?: string | undefined;
  readonly taskUsesDerivedTitle: boolean;
  readonly isEditingTaskTitle: boolean;
  readonly taskTitleDraft: string;
  readonly taskTitleError: string | null;
  readonly isSavingTaskTitle: boolean;
  readonly selectedEventId: string | null;
  readonly selectedConnectorKey: string | null;
  readonly selectedRuleId: string | null;
  readonly selectedTag: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly nowMs: number;
  readonly observabilityStats: {
    readonly actions: number;
    readonly exploredFiles: number;
    readonly compactions: number;
    readonly checks: number;
    readonly violations: number;
    readonly passes: number;
  };
  readonly onSelectEvent: (eventId: string) => void;
  readonly onSelectConnector: (key: string) => void;
  readonly onStartEditTitle: () => void;
  readonly onCancelEditTitle: () => void;
  readonly onSubmitTitle: (event: ReactFormEvent<HTMLFormElement>) => void;
  readonly onTitleDraftChange: (value: string) => void;
  readonly onClearFilters: () => void;
  readonly onToggleRuleGap: (show: boolean) => void;
  readonly onClearRuleId: () => void;
  readonly onClearTag: () => void;
}

/**
 * 5-레인 타임라인 캔버스 컴포넌트.
 * 줌, 레인 토글은 내부 상태로 관리.
 * 이벤트 선택, 커넥터 선택은 콜백으로 상위에 전달.
 */
export function Timeline({
  timeline,
  taskTitle,
  taskWorkspacePath,
  taskStatus,
  taskUpdatedAt,
  taskUsesDerivedTitle,
  isEditingTaskTitle,
  taskTitleDraft,
  taskTitleError,
  isSavingTaskTitle,
  selectedEventId,
  selectedConnectorKey,
  selectedRuleId,
  selectedTag,
  showRuleGapsOnly,
  nowMs,
  observabilityStats,
  onSelectEvent,
  onSelectConnector,
  onStartEditTitle,
  onCancelEditTitle,
  onSubmitTitle,
  onTitleDraftChange,
  onClearFilters,
  onToggleRuleGap,
  onClearRuleId,
  onClearTag
}: TimelineProps): React.JSX.Element {
  const [zoom, setZoom] = useState(1.1);
  const [filters, setFilters] = useState<Record<TimelineLane, boolean>>({
    user: true, exploration: true, planning: true, implementation: true, rules: true
  });
  const [isTimelineDragging, setIsTimelineDragging] = useState(false);
  const [nodeBounds, setNodeBounds] = useState<Record<string, NodeBounds>>({});

  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const isFollowing = useRef(true);
  const dragState = useRef<{
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly scrollLeft: number;
    readonly scrollTop: number;
  } | null>(null);

  // Freeze right anchor for non-running tasks
  const anchorMs = useMemo(() => {
    if (!taskStatus || taskStatus === "running") return nowMs;
    return taskUpdatedAt ? Date.parse(taskUpdatedAt) : nowMs;
  }, [taskStatus, taskUpdatedAt, nowMs]);

  const filteredTimeline = useMemo(
    () => filterTimelineEvents(timeline, {
      laneFilters: filters,
      selectedRuleId,
      selectedTag,
      showRuleGapsOnly
    }),
    [filters, selectedRuleId, selectedTag, showRuleGapsOnly, timeline]
  );

  const timelineLayout = useMemo(
    () => buildTimelineLayout(filteredTimeline, zoom, anchorMs),
    [filteredTimeline, zoom, anchorMs]
  );
  const timestampTicks = useMemo(
    () => buildTimestampTicks(filteredTimeline, timelineLayout, anchorMs),
    [filteredTimeline, timelineLayout, anchorMs]
  );

  useLayoutEffect(() => {
    const canvas = timelineCanvasRef.current;
    if (!canvas) {
      setNodeBounds({});
      return;
    }

    function measureNodes(): void {
      const canvasRect = canvas!.getBoundingClientRect();
      const nextBounds: Record<string, NodeBounds> = {};

      for (const item of timelineLayout.items) {
        const node = nodeRefs.current.get(item.event.id);
        if (!node) continue;

        const rect = node.getBoundingClientRect();
        nextBounds[item.event.id] = {
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          width: rect.width,
          height: rect.height
        };
      }

      setNodeBounds((current) => (
        areNodeBoundsEqual(current, nextBounds) ? current : nextBounds
      ));
    }

    measureNodes();

    const frame = requestAnimationFrame(measureNodes);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => measureNodes());

    observer?.observe(canvas);
    for (const item of timelineLayout.items) {
      const node = nodeRefs.current.get(item.event.id);
      if (node) observer?.observe(node);
    }

    window.addEventListener("resize", measureNodes);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measureNodes);
    };
  }, [timelineLayout.items]);

  const connectors = useMemo(() => {
    return buildTimelineConnectors(timelineLayout.items, nodeBounds as Record<string, TimelineNodeBounds>);
  }, [nodeBounds, timelineLayout.items]);

  const timelineFocusRight = useMemo(() => {
    const measuredRightEdges = timelineLayout.items.map((item) => {
      const bounds = nodeBounds[item.event.id];
      return bounds
        ? bounds.left + bounds.width
        : item.left + NODE_WIDTH / 2;
    });

    return Math.max(timelineLayout.nowLeft, ...measuredRightEdges, 0);
  }, [nodeBounds, timelineLayout.items, timelineLayout.nowLeft]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isFollowing.current) return;

    const rightPadding = Math.max(72, Math.round(el.clientWidth * 0.08));
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const target = Math.max(0, Math.min(maxScrollLeft, timelineFocusRight - el.clientWidth + rightPadding));
    el.scrollLeft = target;
  }, [timelineFocusRight, timelineLayout.items.length]);

  const selectedConnector = useMemo(() => {
    if (!selectedConnectorKey) return null;

    const connector = connectors.find((item) => item.key === selectedConnectorKey);
    if (!connector) return null;

    const source = filteredTimeline.find((event) => event.id === connector.sourceEventId);
    const target = filteredTimeline.find((event) => event.id === connector.targetEventId);
    if (!source || !target) return null;

    return { connector, source, target };
  }, [connectors, filteredTimeline, selectedConnectorKey]);

  const selectedEvent = selectedConnector
    ? null
    : filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[0] ?? null;

  return (
    <section className="main-panel">
      {/* error banner placeholder - handled in App */}

      {/* toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Zoom</span>
          <input
            max={2.5} min={0.8} step={0.1} type="range" value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <span className="toolbar-value">{zoom.toFixed(1)}×</span>
        </div>
        <div className="filters">
          {TIMELINE_LANES.map((lane) => (
            <label
              key={lane}
              className={`filter-chip ${lane}${filters[lane] ? " active" : ""}`}
            >
              <input
                checked={filters[lane]}
                type="checkbox"
                onChange={() => setFilters((c) => ({ ...c, [lane]: !c[lane] }))}
              />
              <span className="filter-dot" />
              {laneLabels[lane]}
            </label>
          ))}
        </div>
      </div>

      <div className="focus-strip">
        <div className="focus-strip-head">
          <span className="toolbar-label">Focus</span>
          <span className="muted small">{filteredTimeline.length}/{timeline.length} events</span>
        </div>
        <div className="focus-strip-body">
          {showRuleGapsOnly && (
            <button
              className="focus-pill active warning"
              onClick={() => onToggleRuleGap(false)}
              type="button"
            >
              No configured rule
            </button>
          )}
          {selectedRuleId && (
            <button
              className="focus-pill active"
              onClick={onClearRuleId}
              type="button"
            >
              Rule: {selectedRuleId}
            </button>
          )}
          {selectedTag && (
            <button
              className="focus-pill active"
              onClick={onClearTag}
              type="button"
            >
              Tag: {selectedTag}
            </button>
          )}
          {!showRuleGapsOnly && !selectedRuleId && !selectedTag && (
            <span className="muted small">Choose a rule or tag from the right rail to focus the timeline.</span>
          )}
        </div>
        {(showRuleGapsOnly || selectedRuleId || selectedTag) && (
          <button
            className="text-button"
            onClick={onClearFilters}
            type="button"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* timeline */}
      <div className="timeline-panel">
        <div className="timeline-header">
          <div className="timeline-title-row">
            {isEditingTaskTitle ? (
              <form className="task-title-form" onSubmit={onSubmitTitle}>
                <div className="task-title-form-row">
                  <input
                    autoFocus
                    className="task-title-input"
                    disabled={isSavingTaskTitle}
                    onChange={(event) => onTitleDraftChange(event.target.value)}
                    placeholder="Rename this task"
                    type="text"
                    value={taskTitleDraft}
                  />
                  <div className="task-title-actions">
                    <button className="compact-focus-button active" disabled={isSavingTaskTitle} type="submit">
                      {isSavingTaskTitle ? "Saving..." : "Save"}
                    </button>
                    <button className="compact-focus-button" disabled={isSavingTaskTitle} onClick={onCancelEditTitle} type="button">
                      Cancel
                    </button>
                  </div>
                </div>
                {taskTitleError && <p className="task-title-error">{taskTitleError}</p>}
              </form>
            ) : (
              <div className="timeline-title-head">
                <h2>{taskTitle ?? "Waiting for task data…"}</h2>
                {taskTitle && (
                  <div className="timeline-title-actions">
                    {taskUsesDerivedTitle && (
                      <span className="event-kind-badge suggested">Suggested title</span>
                    )}
                    <button className="compact-focus-button" onClick={onStartEditTitle} type="button">
                      Rename
                    </button>
                  </div>
                )}
              </div>
            )}
            {taskWorkspacePath && (
              <span className="timeline-workspace mono">{taskWorkspacePath}</span>
            )}
            {!isEditingTaskTitle && taskUsesDerivedTitle && (
              <p className="task-title-helper muted small">
                Showing a title inferred from the task activity. Save it if you want to keep it.
              </p>
            )}
          </div>
          <div className="timeline-badges">
            <span className="summary-badge actions">{observabilityStats.actions} Actions</span>
            <span className="summary-badge files">{observabilityStats.exploredFiles} Files</span>
            <span className="summary-badge compacts">{observabilityStats.compactions} Compact</span>
            <span className="summary-badge checks">{observabilityStats.checks} Check</span>
            <span className="summary-badge violations">{observabilityStats.violations} Violation</span>
            <span className="summary-badge passes">{observabilityStats.passes} Pass</span>
          </div>
        </div>

        <div className="timeline-stage">
          <div className="timeline-edge-fade left" />
          <div className="timeline-edge-fade right" />
          <div className="timeline-gutter-scrim" />
          <div
            className={`timeline-scroll${isTimelineDragging ? " is-dragging" : ""}`}
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              isFollowing.current = el.scrollLeft + el.clientWidth >= timelineFocusRight + 24;
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;

              const target = e.target as HTMLElement | null;
              if (target?.closest(".event-node, .connector-hitbox, button, input, label, a")) return;

              dragState.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                scrollLeft: e.currentTarget.scrollLeft,
                scrollTop: e.currentTarget.scrollTop
              };
              setIsTimelineDragging(true);
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              const current = dragState.current;
              if (!current || current.pointerId !== e.pointerId) return;

              const dx = e.clientX - current.startX;
              const dy = e.clientY - current.startY;
              e.currentTarget.scrollLeft = current.scrollLeft - dx;
              e.currentTarget.scrollTop = current.scrollTop - dy;
            }}
            onPointerUp={(e) => {
              if (dragState.current?.pointerId !== e.pointerId) return;

              dragState.current = null;
              setIsTimelineDragging(false);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={(e) => {
              if (dragState.current?.pointerId !== e.pointerId) return;

              dragState.current = null;
              setIsTimelineDragging(false);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            style={{ cursor: isTimelineDragging ? "grabbing" : "grab" }}
          >
            <div
              className="timeline-canvas"
              ref={timelineCanvasRef}
              style={{ width: `${timelineLayout.width}px`, minHeight: `${CANVAS_HEIGHT}px` }}
            >

              {/* SVG overlay: ruler + grid + connector arrows */}
              <svg
                className="timeline-overlay"
                style={{ width: timelineLayout.width, height: CANVAS_HEIGHT }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {TIMELINE_LANES.map((lane) => (
                    <marker
                      key={lane}
                      id={`arrow-${lane}`}
                      markerWidth="6"
                      markerHeight="4"
                      refX="5"
                      refY="2"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 6 2, 0 4"
                        className={`arrow-tip ${lane}`}
                      />
                    </marker>
                  ))}
                </defs>

                {/* ruler background */}
                <rect x="0" y="0" width={timelineLayout.width} height={RULER_HEIGHT}
                  className="ruler-bg" />
                <line x1="0" y1={RULER_HEIGHT} x2={timelineLayout.width} y2={RULER_HEIGHT}
                  className="ruler-baseline" />

                {/* timestamp ticks + grid lines */}
                {timestampTicks.map((tick) => (
                  <g key={tick.label + tick.x}>
                    <line
                      x1={tick.x} y1={RULER_HEIGHT - 6}
                      x2={tick.x} y2={RULER_HEIGHT}
                      className="ruler-tick"
                    />
                    <text x={tick.x + 4} y={RULER_HEIGHT - 8} className="ruler-label">
                      {tick.label}
                    </text>
                    <line
                      x1={tick.x} y1={RULER_HEIGHT}
                      x2={tick.x} y2={CANVAS_HEIGHT}
                      className="grid-line"
                    />
                  </g>
                ))}

                {/* cross-lane flow lines */}
                {connectors.filter((c) => c.cross).map((c) => (
                  <g key={c.key}>
                    <path
                      d={c.path}
                      className={`connector-hitbox${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConnector(c.key);
                      }}
                    />
                    <path
                      d={c.path}
                      className={`connector ${c.lane} cross-lane${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                    />
                  </g>
                ))}
                {/* same-lane connectors */}
                {connectors.filter((c) => !c.cross).map((c) => (
                  <g key={c.key}>
                    <path
                      d={c.path}
                      className={`connector-hitbox${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConnector(c.key);
                      }}
                    />
                    <path
                      d={c.path}
                      className={`connector ${c.lane}${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      markerEnd={`url(#arrow-${c.lane})`}
                    />
                  </g>
                ))}
              </svg>

              {/* lane rows */}
              {TIMELINE_LANES.map((lane, index) => (
                <div
                  key={lane}
                  className="lane-row"
                  style={{ top: `${RULER_HEIGHT + index * LANE_HEIGHT}px` }}
                >
                  <div className={`lane-label ${lane}`} title={laneDescriptions[lane]}>
                    <img className={`lane-icon ${lane}`} src={laneIcons[lane]} alt="" />
                    {laneLabels[lane]}
                  </div>
                  <div className="lane-track" />
                  <div className="lane-separator" />
                </div>
              ))}

              {/* now line */}
              <div
                className="now-line"
                style={{ left: `${timelineLayout.nowLeft}px`, top: `${RULER_HEIGHT}px` }}
              >
                <span className="now-label">now</span>
              </div>

              {/* event nodes */}
              {timelineLayout.items.map((item) => (
                <button
                  key={item.event.id}
                  className={`event-node ${item.event.lane}${item.event.id === selectedEvent?.id ? " active" : ""}${selectedConnector && (item.event.id === selectedConnector.source.id || item.event.id === selectedConnector.target.id) ? " linked" : ""}`}
                  onClick={() => {
                    onSelectEvent(item.event.id);
                  }}
                  ref={(node) => {
                    if (node) {
                      nodeRefs.current.set(item.event.id, node);
                      return;
                    }

                    nodeRefs.current.delete(item.event.id);
                  }}
                  style={{ left: `${item.left}px`, top: `${item.top}px` }}
                  type="button"
                >
                  <div className="event-node-header">
                    <img src={laneIcons[item.event.lane]} alt="" />
                    <span className="event-lane-tag">{item.event.lane}</span>
                  </div>
                  <strong>{item.event.kind === "task.start" ? (taskTitle ?? item.event.title) : item.event.title}</strong>
                  <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
                </button>
              ))}

            </div>
          </div>
        </div>

        {/* mini-map */}
        {timelineLayout.items.length > 0 && (
          <MiniMap
            items={timelineLayout.items}
            canvasWidth={timelineLayout.width}
          />
        )}
      </div>
    </section>
  );
}

export type { NodeBounds };
export { areNodeBoundsEqual };
