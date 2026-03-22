/**
 * 5-레인 타임라인 캔버스.
 * 이벤트 노드, 연결선, 타임스탬프 눈금 렌더링.
 * 수평 스크롤, 줌(0.5x~5x), 레인 토글 지원.
 * 태스크 제목 편집 기능 포함.
 */

import type React from "react";
import { type FormEvent as ReactFormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { TimelineItemLayout, TimelineNodeBounds } from "../lib/timeline.js";
import {
  buildTimelineContextSummary,
  buildTimelineConnectors,
  buildTimelineLayout,
  buildTimestampTicks,
  formatRelativeTime,
  LANE_HEIGHT,
  NODE_WIDTH,
  ROW_VERTICAL_OFFSET,
  RULER_HEIGHT,
  TIMELINE_LANES
} from "../lib/timeline.js";
import { resolveExplorationCategory } from "../lib/explorationCategory.js";
import { filterTimelineEvents } from "../lib/insights.js";
import { cn } from "../lib/ui/cn.js";
import { getLaneTheme } from "../lib/ui/laneTheme.js";
import type { MonitoringTask, TimelineEvent, TimelineLane } from "../types.js";
import { Button } from "./ui/Button.js";
import "./Timeline.css";

// CANVAS_HEIGHT is computed dynamically from active lanes in the component

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

const OBSERVABILITY_BADGE_STYLES = {
  actions: "border-[var(--implementation-border)] bg-[var(--implementation-bg)] text-[var(--implementation)]",
  coordination: "border-[var(--coordination-border)] bg-[var(--coordination-bg)] text-[var(--coordination)]",
  files: "border-[var(--exploration-border)] bg-[var(--exploration-bg)] text-[var(--exploration)]",
  compacts: "border-[color-mix(in_srgb,var(--planning)_28%,white)] bg-[color-mix(in_srgb,var(--planning)_10%,white)] text-[var(--planning)]",
  checks: "border-[var(--coordination-border)] bg-[var(--coordination-bg)] text-[var(--coordination)]",
  violations: "border-[#fecaca] bg-[#fef2f2] text-[var(--err)]",
  passes: "border-[#bbf7d0] bg-[#f0fdf4] text-[var(--ok)]"
} as const;

const TASK_STATUS_BUTTON_STYLES = {
  running: {
    active: "border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)]",
    idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--ok)] hover:bg-[var(--ok-bg)]/70 hover:text-[var(--ok)]"
  },
  waiting: {
    active: "border-[#d97706] bg-[#fef3c7] text-[#b45309]",
    idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[#d97706] hover:bg-[#fef3c7] hover:text-[#b45309]"
  },
  completed: {
    active: "border-[var(--done)] bg-[var(--done-bg)] text-[var(--done)]",
    idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--done)] hover:bg-[var(--done-bg)]/70 hover:text-[var(--done)]"
  },
  errored: {
    active: "border-[var(--err)] bg-[var(--err-bg)] text-[var(--err)]",
    idle: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] hover:border-[var(--err)] hover:bg-[var(--err-bg)]/70 hover:text-[var(--err)]"
  }
} as const;



interface TimelineProps {
  readonly timeline: readonly TimelineEvent[];
  readonly taskTitle: string | null;
  readonly taskId?: string | null;
  readonly taskWorkspacePath?: string | undefined;
  readonly taskStatus?: "running" | "waiting" | "completed" | "errored" | undefined;
  readonly taskUpdatedAt?: string | undefined;
  readonly taskUsesDerivedTitle: boolean;
  readonly isEditingTaskTitle: boolean;
  readonly taskTitleDraft: string;
  readonly taskTitleError: string | null;
  readonly isSavingTaskTitle: boolean;
  readonly isUpdatingTaskStatus?: boolean;
  readonly selectedEventId: string | null;
  readonly selectedConnectorKey: string | null;
  readonly selectedRuleId: string | null;
  readonly selectedTag: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly nowMs: number;
  readonly zoom: number;
  readonly backgroundTasks: readonly MonitoringTask[];
  readonly onZoomChange: (zoom: number) => void;
  readonly observabilityStats: {
    readonly actions: number;
    readonly coordinationActivities: number;
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
  readonly onChangeTaskStatus?: (status: "running" | "waiting" | "completed" | "errored") => void;
}

export function shouldResetTimelineFollowForTaskChange(input: {
  previousTaskId: string | null | undefined;
  nextTaskId: string | null | undefined;
  selectedEventId: string | null;
  timeline: readonly TimelineEvent[];
}): boolean {
  if (!input.nextTaskId || input.previousTaskId === input.nextTaskId) {
    return false;
  }

  if (!input.selectedEventId) {
    return true;
  }

  return !input.timeline.some((event) => event.id === input.selectedEventId);
}

export function computeTimelineFollowScrollLeft(input: {
  clientWidth: number;
  scrollWidth: number;
  timelineFocusRight: number;
}): number {
  const rightPadding = Math.max(72, Math.round(input.clientWidth * 0.08));
  const maxScrollLeft = Math.max(0, input.scrollWidth - input.clientWidth);
  return Math.max(
    0,
    Math.min(maxScrollLeft, input.timelineFocusRight - input.clientWidth + rightPadding)
  );
}

/**
 * 5-레인 타임라인 캔버스 컴포넌트.
 * 줌, 레인 토글은 내부 상태로 관리.
 * 이벤트 선택, 커넥터 선택은 콜백으로 상위에 전달.
 */
export function Timeline({
  timeline,
  taskTitle,
  taskId,
  taskWorkspacePath,
  taskStatus,
  taskUpdatedAt,
  taskUsesDerivedTitle,
  isEditingTaskTitle,
  taskTitleDraft,
  taskTitleError,
  isSavingTaskTitle,
  isUpdatingTaskStatus = false,
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
  onClearTag,
  onChangeTaskStatus,
  zoom,
  onZoomChange,
  backgroundTasks
}: TimelineProps): React.JSX.Element {
  const [filters, setFilters] = useState<Record<TimelineLane, boolean>>({
    user: true, exploration: true, planning: true, coordination: true, background: true,
    implementation: true, questions: true, todos: true
  });
  const [isTimelineDragging, setIsTimelineDragging] = useState(false);
  const [nodeBounds, setNodeBounds] = useState<Record<string, NodeBounds>>({});
  const [isContextCollapsed, setIsContextCollapsed] = useState(true);

  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const isFollowing = useRef(true);
  const previousTaskId = useRef<string | null | undefined>(taskId);
  const lastScrolledEventId = useRef<string | null>(null);
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

  const activeLanes = useMemo(
    () => TIMELINE_LANES.filter((l) => filters[l]),
    [filters]
  );

  const canvasHeight = RULER_HEIGHT + activeLanes.length * LANE_HEIGHT;

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
    () => buildTimelineLayout(filteredTimeline, zoom, anchorMs, activeLanes),
    [filteredTimeline, zoom, anchorMs, activeLanes]
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

    el.scrollLeft = computeTimelineFollowScrollLeft({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      timelineFocusRight
    });
  }, [timelineFocusRight]);

  useEffect(() => {
    const shouldReset = shouldResetTimelineFollowForTaskChange({
      previousTaskId: previousTaskId.current,
      nextTaskId: taskId,
      selectedEventId,
      timeline: filteredTimeline
    });
    previousTaskId.current = taskId;
    if (!shouldReset) return;

    isFollowing.current = true;
    const el = scrollRef.current;
    if (!el) return;

    el.scrollLeft = computeTimelineFollowScrollLeft({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      timelineFocusRight
    });
  }, [filteredTimeline, selectedEventId, taskId, timelineFocusRight]);

  // selectedEventId가 바뀌면 해당 노드가 타임라인 뷰포트에 보이도록 수평 스크롤
  useEffect(() => {
    if (!selectedEventId) return;
    if (lastScrolledEventId.current === selectedEventId) return;

    const el = scrollRef.current;
    if (!el) return;

    const item = timelineLayout.items.find((i) => i.event.id === selectedEventId);
    if (!item) return;

    lastScrolledEventId.current = selectedEventId;

    const nodeCenter = item.left + NODE_WIDTH / 2;
    const targetScroll = nodeCenter - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, targetScroll));
    isFollowing.current = false;
  }, [selectedEventId, timelineLayout.items]);

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
    : filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[filteredTimeline.length - 1] ?? null;

  const contextSummary = useMemo(() => buildTimelineContextSummary({
    filteredEventCount: filteredTimeline.length,
    totalEventCount: timeline.length,
    activeLaneCount: activeLanes.length,
    totalLaneCount: TIMELINE_LANES.length,
    selectedRuleId,
    selectedTag,
    showRuleGapsOnly
  }), [activeLanes.length, filteredTimeline.length, selectedRuleId, selectedTag, showRuleGapsOnly, timeline.length]);

  // row-0 카드를 키로, 같은 위치에 스택된 전체 아이템 배열(본인 포함)을 값으로 저장.
  const stackGroups = useMemo(() => {
    const map = new Map<string, readonly TimelineItemLayout[]>();
    for (const frontItem of timelineLayout.items) {
      if (frontItem.rowIndex !== 0) continue;
      const group = timelineLayout.items.filter(
        (other) =>
          other.event.lane === frontItem.event.lane &&
          Math.abs(other.left - frontItem.left) < NODE_WIDTH
      );
      if (group.length > 1) map.set(frontItem.event.id, group);
    }
    return map;
  }, [timelineLayout.items]);

  // 팝오버를 열 row-0 카드의 eventId. null이면 닫힌 상태.
  const [openStackEventId, setOpenStackEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!openStackEventId) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpenStackEventId(null);
    };
    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".stack-popover") && !target?.closest(".stack-badge-btn")) {
        setOpenStackEventId(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, [openStackEventId]);

  useEffect(() => {
    if (isEditingTaskTitle && isContextCollapsed) {
      setIsContextCollapsed(false);
    }
  }, [isContextCollapsed, isEditingTaskTitle]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      {/* error banner placeholder - handled in App */}

      <div className="timeline-panel">
        {isContextCollapsed && !isEditingTaskTitle ? (
          <div className="timeline-context-bar">
            <div className="timeline-context-bar-main">
              <div className="timeline-context-copy">
                <div className="timeline-context-title-row">
                  <strong className="timeline-context-title">{taskTitle ?? "Waiting for task data…"}</strong>
                  {taskUsesDerivedTitle && taskTitle && (
                    <span className="timeline-context-summary-chip accent">Suggested</span>
                  )}
                </div>
                <div className="timeline-context-summary-row">
                  <span className="timeline-context-summary-chip">{contextSummary.eventSummary}</span>
                  <span className="timeline-context-summary-chip">{contextSummary.laneSummary}</span>
                  {contextSummary.focusSummary && (
                    <span className="timeline-context-summary-chip emphasis">{contextSummary.focusSummary}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="timeline-context-bar-actions">
              {taskStatus && (
                <span
                  className={cn(
                    "timeline-context-status",
                    TASK_STATUS_BUTTON_STYLES[taskStatus].active
                  )}
                >
                  {taskStatus}
                </span>
              )}
              <Button
                aria-label="Expand timeline controls"
                className="timeline-context-toggle"
                onClick={() => setIsContextCollapsed(false)}
                size="icon"
                type="button"
                variant="bare"
              >
                ▾
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="timeline-chrome">
              {/* toolbar */}
              <div className="timeline-toolbar toolbar flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <div className="toolbar-group">
                  <span className="toolbar-label">Zoom</span>
                  <input
                    max={2.5} min={0.8} step={0.1} type="range" value={zoom}
                    onChange={(e) => onZoomChange(Number(e.target.value))}
                  />
                  <span className="toolbar-value">{zoom.toFixed(1)}×</span>
                </div>
                <div className="filters">
                  <button
                    className={`filter-chip all-toggle${activeLanes.length === TIMELINE_LANES.length ? " active" : ""}`}
                    type="button"
                    onClick={() => {
                      const allOn = activeLanes.length === TIMELINE_LANES.length;
                      const next = Object.fromEntries(TIMELINE_LANES.map((l) => [l, !allOn])) as Record<TimelineLane, boolean>;
                      setFilters(next);
                    }}
                  >
                    {activeLanes.length === TIMELINE_LANES.length ? "All" : `${activeLanes.length}/${TIMELINE_LANES.length}`}
                  </button>
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
                      {getLaneTheme(lane).label}
                    </label>
                  ))}
                </div>
                <Button
                  aria-label="Collapse timeline controls"
                  className="ml-auto h-8 rounded-full px-3 text-[0.76rem] font-semibold shadow-none"
                  onClick={() => setIsContextCollapsed(true)}
                  size="sm"
                  type="button"
                >
                  Collapse
                </Button>
              </div>

              <div className="timeline-focus-strip focus-strip flex flex-wrap items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="focus-strip-head">
                  <span className="toolbar-label">Focus</span>
                  <span className="text-[0.79rem] text-[var(--text-2)]">{filteredTimeline.length}/{timeline.length} events</span>
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
                    <span className="text-[0.79rem] text-[var(--text-2)]">Choose a rule or tag from the right rail to focus the timeline.</span>
                  )}
                </div>
                {(showRuleGapsOnly || selectedRuleId || selectedTag) && (
                  <Button
                    className="h-auto px-0 text-[0.78rem] font-semibold text-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={onClearFilters}
                    size="sm"
                    type="button"
                    variant="bare"
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              <div className="timeline-header">
                <div className="timeline-title-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {isEditingTaskTitle ? (
                      <form className="task-title-form" onSubmit={onSubmitTitle}>
                        <div className="task-title-form-row">
                          <input
                            className="task-title-input"
                            disabled={isSavingTaskTitle}
                            onChange={(event) => onTitleDraftChange(event.target.value)}
                            placeholder="Rename this task"
                            type="text"
                            value={taskTitleDraft}
                          />
                          <div className="task-title-actions">
                            <Button
                              className="h-7 rounded-full border-[var(--accent)] bg-[var(--accent-light)] px-3 text-[0.72rem] font-semibold text-[var(--accent)] shadow-none hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                              disabled={isSavingTaskTitle}
                              size="sm"
                              type="submit"
                            >
                              {isSavingTaskTitle ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none"
                              disabled={isSavingTaskTitle}
                              onClick={onCancelEditTitle}
                              size="sm"
                              type="button"
                            >
                              Cancel
                            </Button>
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
                              <span className="inline-flex h-7 items-center rounded-full border border-[var(--accent-light)] bg-[var(--accent-light)] px-3 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">
                                Suggested
                              </span>
                            )}
                            <Button
                              className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none"
                              onClick={onStartEditTitle}
                              size="sm"
                              type="button"
                            >
                              Rename
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {taskWorkspacePath && (
                      <span className="timeline-workspace block truncate font-mono">{taskWorkspacePath}</span>
                    )}
                  </div>
                  {!isEditingTaskTitle && taskStatus && onChangeTaskStatus && (
                    <div className="task-status-row">
                      {(["running", "waiting", "completed", "errored"] as const).map((s) => (
                        <Button
                          key={s}
                          className={cn(
                            "h-7 rounded-full px-3 text-[0.68rem] font-semibold uppercase tracking-[0.06em] shadow-none",
                            taskStatus === s
                              ? TASK_STATUS_BUTTON_STYLES[s].active
                              : TASK_STATUS_BUTTON_STYLES[s].idle
                          )}
                          disabled={isUpdatingTaskStatus || taskStatus === s}
                          onClick={() => onChangeTaskStatus(s)}
                          size="sm"
                          type="button"
                          variant="bare"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2">
                  {[
                    { key: "actions", label: "Actions", value: observabilityStats.actions },
                    { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities },
                    { key: "files", label: "Files", value: observabilityStats.exploredFiles },
                    { key: "compacts", label: "Compact", value: observabilityStats.compactions },
                    { key: "checks", label: "Check", value: observabilityStats.checks },
                    { key: "violations", label: "Violation", value: observabilityStats.violations },
                    { key: "passes", label: "Pass", value: observabilityStats.passes }
                  ].map((badge) => (
                    <div
                      key={badge.key}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.72rem] font-semibold tracking-[0.02em]",
                        OBSERVABILITY_BADGE_STYLES[badge.key as keyof typeof OBSERVABILITY_BADGE_STYLES]
                      )}
                    >
                      <span className="text-[0.78rem] font-bold leading-none">{badge.value}</span>
                      <span className="leading-none">{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="timeline-stage" style={{ minHeight: `${canvasHeight}px` }}>
          {filteredTimeline.length === 0 && (
            <div className="timeline-empty-state">
              <p>아직 이벤트가 없습니다</p>
              <span>에이전트가 실행되면 여기에 이벤트가 표시됩니다.</span>
            </div>
          )}
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
            style={{
              cursor: isTimelineDragging ? "grabbing" : "grab"
            }}
          >
            <div
              className="timeline-canvas"
              ref={timelineCanvasRef}
              style={{ width: `${timelineLayout.width}px`, minHeight: `${canvasHeight}px` }}
            >

              {/* SVG overlay: ruler + grid + connector arrows */}
              <svg
                className="timeline-overlay"
                style={{ width: timelineLayout.width, height: canvasHeight }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Timeline overlay</title>
                <defs>
                  {TIMELINE_LANES.map((lane) => (
                    (() => {
                      return (
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
                      );
                    })()
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
                      x2={tick.x} y2={canvasHeight}
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
                      onClick={() => onSelectConnector(c.key)}
                    />
                    <path
                      d={c.path}
                      className={`connector ${c.lane} cross-lane${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      onClick={() => onSelectConnector(c.key)}
                    />
                  </g>
                ))}
                {/* same-lane connectors */}
                {connectors.filter((c) => !c.cross).map((c) => (
                  <g key={c.key}>
                    <path
                      d={c.path}
                      className={`connector-hitbox${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      onClick={() => onSelectConnector(c.key)}
                    />
                    <path
                      d={c.path}
                      className={`connector ${c.lane}${selectedConnector?.connector.key === c.key ? " active" : ""}`}
                      markerEnd={`url(#arrow-${c.lane})`}
                      onClick={() => onSelectConnector(c.key)}
                    />
                  </g>
                ))}
              </svg>

              {/* lane rows — only visible (active) lanes */}
              {activeLanes.map((lane, index) => (
                (() => {
                  const laneTheme = getLaneTheme(lane);
                  return (
                    <div
                      key={lane}
                      className={cn("lane-row", index % 2 === 1 && "striped")}
                      style={{ top: `${RULER_HEIGHT + index * LANE_HEIGHT}px` }}
                    >
                      <div className={`lane-label ${lane}`} title={laneTheme.description}>
                        <img className={`lane-icon ${lane}`} src={laneTheme.icon} alt="" />
                        {laneTheme.label}
                      </div>
                      <div className="lane-track" />
                      <div className="lane-separator" />
                    </div>
                  );
                })()
              ))}

              {/* background task region boxes */}
              {backgroundTasks.length > 0 && activeLanes.includes("background") && (() => {
                const bgLaneIndex = activeLanes.indexOf("background");
                const laneTop = RULER_HEIGHT + bgLaneIndex * LANE_HEIGHT;
                return backgroundTasks.map((bgTask) => {
                  const startMs = Date.parse(bgTask.createdAt);
                  const endMs = bgTask.updatedAt ? Date.parse(bgTask.updatedAt) : anchorMs;
                  const left = timelineLayout.tsToLeft(startMs);
                  const right = timelineLayout.tsToLeft(endMs);
                  const width = Math.max(right - left, 8);
                  const label = bgTask.displayTitle ?? bgTask.title;
                  return (
                    <div
                      key={bgTask.id}
                      className="bg-task-region"
                      style={{
                        left: `${left - NODE_WIDTH / 2}px`,
                        top: `${laneTop + 4}px`,
                        width: `${width + NODE_WIDTH}px`,
                        height: `${LANE_HEIGHT - 8}px`
                      }}
                      title={label}
                    >
                      <span className="bg-task-region-label">{label}</span>
                    </div>
                  );
                });
              })()}

              {/* now line */}
              <div
                className="now-line"
                style={{ left: `${timelineLayout.nowLeft}px`, top: `${RULER_HEIGHT}px` }}
              >
                <span className="now-label">now</span>
              </div>

              {/* event nodes — rowIndex 내림차순 정렬: 높은 행(뒤)부터 렌더해 낮은 행(앞)이 위에 표시됨 */}
              {[...timelineLayout.items]
                .sort((a, b) => b.rowIndex - a.rowIndex)
                .map((item) => (
                  (() => {
                    const questionPhase = typeof item.event.metadata["questionPhase"] === "string"
                      ? item.event.metadata["questionPhase"]
                      : undefined;
                    const todoState = typeof item.event.metadata["todoState"] === "string"
                      ? item.event.metadata["todoState"]
                      : undefined;
                    const relationLabel = typeof item.event.metadata["relationLabel"] === "string"
                      ? item.event.metadata["relationLabel"]
                      : typeof item.event.metadata["relationType"] === "string"
                        ? String(item.event.metadata["relationType"]).replace(/_/g, " ")
                        : undefined;
                    const activityType = typeof item.event.metadata["activityType"] === "string"
                      ? item.event.metadata["activityType"]
                      : undefined;
                    const agentName = typeof item.event.metadata["agentName"] === "string"
                      ? item.event.metadata["agentName"]
                      : undefined;
                    const skillName = typeof item.event.metadata["skillName"] === "string"
                      ? item.event.metadata["skillName"]
                      : undefined;
                    const mcpTool = typeof item.event.metadata["mcpTool"] === "string"
                      ? item.event.metadata["mcpTool"]
                      : undefined;
                    const workItemId = typeof item.event.metadata["workItemId"] === "string"
                      ? item.event.metadata["workItemId"]
                      : typeof item.event.metadata["todoId"] === "string"
                        ? item.event.metadata["todoId"]
                        : undefined;

                    const stackGroup = stackGroups.get(item.event.id);
                    const stackCount = stackGroup ? stackGroup.length - 1 : 0;
                    const nodeTop = item.top + item.rowIndex * ROW_VERTICAL_OFFSET;

                    return (
                      <div
                        key={item.event.id}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          `event-node ${item.event.lane}`,
                          item.event.id === selectedEvent?.id && "active",
                          selectedConnector && (item.event.id === selectedConnector.source.id || item.event.id === selectedConnector.target.id) && "linked",
                          item.rowIndex > 0 && "stacked-behind"
                        )}
                        onClick={() => {
                          onSelectEvent(item.event.id);
                          setOpenStackEventId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectEvent(item.event.id);
                            setOpenStackEventId(null);
                          }
                        }}
                        ref={(node) => {
                          if (node) {
                            nodeRefs.current.set(item.event.id, node);
                            return;
                          }

                          nodeRefs.current.delete(item.event.id);
                        }}
                        style={{ left: `${item.left}px`, top: `${nodeTop}px` }}
                      >
                        <div className="event-node-header">
                          <span className="event-node-dot" />
                          <span className="event-lane-tag">{item.event.lane}</span>
                          {item.event.lane === "exploration" && (() => {
                            const cat = resolveExplorationCategory(item.event);
                            return cat ? (
                              <span
                                aria-label={cat.category}
                                className="text-[0.75rem] opacity-70 select-none leading-none"
                                role="img"
                                title={cat.category}
                              >
                                {cat.icon}
                              </span>
                            ) : null;
                          })()}
                          {stackCount > 0 && (
                            <button
                              className="stack-badge-btn"
                              title={`${stackCount + 1}개 이벤트 겹침 — 클릭해서 모두 보기`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStackEventId(
                                  openStackEventId === item.event.id ? null : item.event.id
                                );
                              }}
                            >
                              +{stackCount}
                            </button>
                          )}
                        </div>
                        <strong>{item.event.kind === "task.start" ? (taskTitle ?? item.event.title) : item.event.title}</strong>
                        <div className="event-node-chips">
                          {activityType && <span className="event-semantic-tag">{activityType.replace(/_/g, " ")}</span>}
                          {relationLabel && <span className="event-semantic-tag subtle">{relationLabel}</span>}
                          {agentName && <span className="event-semantic-tag subtle">{agentName}</span>}
                          {skillName && <span className="event-semantic-tag subtle">skill:{skillName}</span>}
                          {!skillName && mcpTool && <span className="event-semantic-tag subtle">mcp:{mcpTool}</span>}
                          {workItemId && <span className="event-semantic-tag subtle">work:{workItemId}</span>}
                        </div>
                        {item.event.kind === "question.logged" && questionPhase && (
                          <span className="event-semantic-tag">{questionPhase}</span>
                        )}
                        {item.event.kind === "todo.logged" && todoState && (
                          <span className="event-semantic-tag">{todoState.replace("_", " ")}</span>
                        )}
                        <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
                      </div>
                    );
                  })()
                ))}

              {/* stack popover — 스택 배지 클릭 시 같은 위치의 모든 이벤트 목록 */}
              {openStackEventId && (() => {
                const frontItem = timelineLayout.items.find((i) => i.event.id === openStackEventId);
                if (!frontItem) return null;
                const group = stackGroups.get(openStackEventId);
                if (!group) return null;
                const bounds = nodeBounds[openStackEventId];
                if (!bounds) return null;
                const popoverLeft = bounds.left;
                const popoverTop = bounds.top + bounds.height + 6;
                const sortedGroup = [...group].sort(
                  (a, b) => Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt)
                );
                return (
                  <div
                    className="stack-popover"
                    style={{ left: `${popoverLeft}px`, top: `${popoverTop}px` }}
                  >
                    <div className="stack-popover-header">
                      {group.length}개 이벤트 겹침
                    </div>
                    {sortedGroup.map((groupItem) => {
                      const gt = getLaneTheme(groupItem.event.lane);
                      return (
                        <button
                          key={groupItem.event.id}
                          className={cn(
                            "stack-popover-item",
                            groupItem.event.lane,
                            groupItem.event.id === selectedEvent?.id && "active"
                          )}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(groupItem.event.id);
                            setOpenStackEventId(null);
                          }}
                        >
                          <img className={`stack-item-icon ${groupItem.event.lane}`} src={gt.icon} alt="" />
                          <span className="stack-item-title">
                            {groupItem.event.kind === "task.start"
                              ? (taskTitle ?? groupItem.event.title)
                              : groupItem.event.title}
                          </span>
                          <span className="stack-item-time">{formatRelativeTime(groupItem.event.createdAt)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>
        </div>

        {/* Minimap */}
        {filteredTimeline.length > 0 && (
          <TimelineMinimap
            timelineWidth={timelineLayout.width}
            canvasHeight={canvasHeight}
            items={timelineLayout.items}
            activeLanes={activeLanes}
            scrollRef={scrollRef}
          />
        )}

      </div>
    </section>
  );
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

interface MinimapProps {
  readonly timelineWidth: number;
  readonly canvasHeight: number;
  readonly items: readonly TimelineItemLayout[];
  readonly activeLanes: readonly string[];
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}

function TimelineMinimap({ timelineWidth, canvasHeight: _canvasHeight, items, activeLanes, scrollRef }: MinimapProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: 0, viewWidth: 0, totalWidth: 1 });
  const isDragging = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = (): void => {
      setScrollState({ left: el.scrollLeft, viewWidth: el.clientWidth, totalWidth: Math.max(el.scrollWidth, 1) });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef]);

  const scrubToClientX = (clientX: number): void => {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container || !scrollEl) return;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = ratio * scrollState.totalWidth - scrollState.viewWidth / 2;
    scrollEl.scrollLeft = Math.max(0, Math.min(scrollState.totalWidth - scrollState.viewWidth, target));
  };

  const laneCount = activeLanes.length;
  const viewportLeftPct = (scrollState.left / scrollState.totalWidth) * 100;
  const viewportWidthPct = (scrollState.viewWidth / scrollState.totalWidth) * 100;

  if (laneCount === 0 || timelineWidth === 0) return null;

  return (
    <div
      ref={containerRef}
      className="timeline-minimap"
      role="scrollbar"
      aria-label="Timeline minimap"
      aria-valuenow={Math.round(viewportLeftPct)}
      onPointerDown={(e) => {
        isDragging.current = true;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        scrubToClientX(e.clientX);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (!isDragging.current) return;
        scrubToClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        isDragging.current = false;
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={(e) => {
        isDragging.current = false;
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      }}
    >
      {/* Lane stripes */}
      {activeLanes.map((lane, i) => (
        <div
          key={lane}
          className={`minimap-lane ${lane}`}
          style={{
            top: `${(i / laneCount) * 100}%`,
            height: `${(1 / laneCount) * 100}%`
          }}
        />
      ))}

      {/* Event dots */}
      {items.map((item) => {
        const laneIndex = activeLanes.indexOf(item.event.lane);
        if (laneIndex < 0) return null;
        const leftPct = (item.left / timelineWidth) * 100;
        const topPct = ((laneIndex + 0.5) / laneCount) * 100;
        return (
          <div
            key={item.event.id}
            className={`minimap-dot ${item.event.lane}`}
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          />
        );
      })}

      {/* Viewport indicator */}
      <div
        className="minimap-viewport"
        style={{ left: `${viewportLeftPct}%`, width: `${Math.max(viewportWidthPct, 2)}%` }}
      />
    </div>
  );
}

export type { NodeBounds };
export { areNodeBoundsEqual };
