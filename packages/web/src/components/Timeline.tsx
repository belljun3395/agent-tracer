import type React from "react";
import { type FormEvent as ReactFormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TimelineItemLayout, TimelineNodeBounds } from "@monitor/web-core";
import { buildDisplayLaneRows, countLaneSubtypes, isExpandableLane, resolveEventSubtype, type ExpandableTimelineLane, type TimelineLaneRow } from "@monitor/web-core";
import { buildTimelineContextSummary, buildTimelineConnectors, buildTimelineLayout, buildTimestampTicks, formatRelativeTime, LANE_HEIGHT, NODE_WIDTH, ROW_VERTICAL_OFFSET, RULER_HEIGHT, TIMELINE_LANES } from "@monitor/web-core";
import { filterTimelineEvents } from "@monitor/web-core";
import { cn } from "../lib/ui/cn.js";
import { getLaneTheme } from "../lib/ui/laneTheme.js";
import type { TimelineEvent, TimelineLane } from "@monitor/web-core";
import { Button } from "./ui/Button.js";
import "./Timeline.css";
interface NodeBounds {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}
function areNodeBoundsEqual(current: Readonly<Record<string, NodeBounds>>, next: Readonly<Record<string, NodeBounds>>): boolean {
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
        if (Math.abs(currentBounds.left - nextBounds.left) > 0.5 ||
            Math.abs(currentBounds.top - nextBounds.top) > 0.5 ||
            Math.abs(currentBounds.width - nextBounds.width) > 0.5 ||
            Math.abs(currentBounds.height - nextBounds.height) > 0.5) {
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
type TimelineObservabilityStats = TimelineProps["observabilityStats"];
function formatTaskStatusLabel(status: "running" | "waiting" | "completed" | "errored"): string {
    switch (status) {
        case "running":
            return "Running";
        case "waiting":
            return "Waiting";
        case "completed":
            return "Completed";
        case "errored":
            return "Errored";
    }
}
function TimelineContextBar({ taskTitle, taskUsesDerivedTitle, contextSummary, showRuleGapsOnly, onToggleRuleGap, selectedRuleId, onClearRuleId, selectedTag, onClearTag, observabilityStats, taskStatus, isTaskControlsOpen, isEditingTaskTitle, controlsButtonRef, setControlsPopoverPos, setIsTaskControlsOpen, isFiltersOpen, filtersButtonRef, setFiltersPopoverPos, setIsFiltersOpen, activeLaneCount, totalLaneCount }: {
    readonly taskTitle: string | null;
    readonly taskUsesDerivedTitle: boolean;
    readonly contextSummary: ReturnType<typeof buildTimelineContextSummary>;
    readonly showRuleGapsOnly: boolean;
    readonly onToggleRuleGap: (show: boolean) => void;
    readonly selectedRuleId: string | null;
    readonly onClearRuleId: () => void;
    readonly selectedTag: string | null;
    readonly onClearTag: () => void;
    readonly observabilityStats: TimelineObservabilityStats;
    readonly taskStatus?: TimelineProps["taskStatus"];
    readonly isTaskControlsOpen: boolean;
    readonly isEditingTaskTitle: boolean;
    readonly controlsButtonRef: React.RefObject<HTMLButtonElement | null>;
    readonly setControlsPopoverPos: (value: {
        top: number;
        right: number;
    }) => void;
    readonly setIsTaskControlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    readonly isFiltersOpen: boolean;
    readonly filtersButtonRef: React.RefObject<HTMLButtonElement | null>;
    readonly setFiltersPopoverPos: (value: {
        top: number;
        right: number;
    }) => void;
    readonly setIsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
    readonly activeLaneCount: number;
    readonly totalLaneCount: number;
}): React.JSX.Element {
    return (<div className="timeline-context-bar" style={{ position: "relative" }}>
      <div className="timeline-context-bar-main">
        <div className="timeline-context-copy">
          <div className="timeline-context-title-row">
            <strong className="timeline-context-title">{taskTitle ?? "Waiting for task data…"}</strong>
            {taskUsesDerivedTitle && taskTitle && (<span className="timeline-context-summary-chip accent">Suggested</span>)}
          </div>
          <div className="timeline-context-summary-row">
            <span className="timeline-context-summary-chip">{contextSummary.eventSummary}</span>
            {contextSummary.focusSummary && (<span className="timeline-context-summary-chip emphasis">{contextSummary.focusSummary}</span>)}
            {showRuleGapsOnly && (<button className="timeline-context-summary-chip emphasis" onClick={() => onToggleRuleGap(false)} type="button">
                Gaps only ×
              </button>)}
            {selectedRuleId && (<button className="timeline-context-summary-chip emphasis" onClick={onClearRuleId} type="button">
                Rule: {selectedRuleId} ×
              </button>)}
            {selectedTag && (<button className="timeline-context-summary-chip emphasis" onClick={onClearTag} type="button">
                Tag: {selectedTag} ×
              </button>)}
          </div>
        </div>
      </div>

      <div className="timeline-context-bar-actions">
        {(observabilityStats.violations > 0 || observabilityStats.checks > 0) && (<span className="timeline-context-summary-chip timeline-context-obs-stats" style={{ gap: 4, fontSize: "0.66rem" }}>
            {observabilityStats.violations > 0 && <span style={{ color: "var(--err)" }}>{observabilityStats.violations}v</span>}
            {observabilityStats.checks > 0 && <span>{observabilityStats.checks}c</span>}
            {observabilityStats.passes > 0 && <span style={{ color: "var(--ok)" }}>{observabilityStats.passes}p</span>}
          </span>)}

        {taskStatus && (<span className={cn("timeline-context-status", TASK_STATUS_BUTTON_STYLES[taskStatus].active)}>
            {taskStatus}
          </span>)}

        <button ref={controlsButtonRef} aria-expanded={isTaskControlsOpen || isEditingTaskTitle} className={cn("timeline-context-toggle", (isTaskControlsOpen || isEditingTaskTitle) && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")} onClick={() => {
            if (controlsButtonRef.current) {
                const rect = controlsButtonRef.current.getBoundingClientRect();
                setControlsPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
            }
            setIsTaskControlsOpen((value) => !value);
        }} title="Task controls" type="button">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>

        <button ref={filtersButtonRef} aria-expanded={isFiltersOpen} className={cn("timeline-context-toggle", isFiltersOpen && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")} onClick={() => {
            if (filtersButtonRef.current) {
                const rect = filtersButtonRef.current.getBoundingClientRect();
                setFiltersPopoverPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
            }
            setIsFiltersOpen((value) => !value);
        }} title="Filters & Zoom" type="button">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/>
          </svg>
          {activeLaneCount < totalLaneCount && (<span style={{ fontSize: "0.58rem", fontWeight: 700, lineHeight: 1 }}>
              {activeLaneCount}
            </span>)}
        </button>
      </div>
    </div>);
}
function TimelineFiltersPopover({ filtersPopoverRef, filtersPopoverPos, zoom, onZoomChange, activeLaneCount, totalLaneCount, filters, setFilters }: {
    readonly filtersPopoverRef: React.RefObject<HTMLDivElement | null>;
    readonly filtersPopoverPos: {
        top: number;
        right: number;
    };
    readonly zoom: number;
    readonly onZoomChange: (zoom: number) => void;
    readonly activeLaneCount: number;
    readonly totalLaneCount: number;
    readonly filters: Record<TimelineLane, boolean>;
    readonly setFilters: React.Dispatch<React.SetStateAction<Record<TimelineLane, boolean>>>;
}): React.JSX.Element {
    return (<div ref={filtersPopoverRef} className="timeline-filters-popover" style={{ position: "fixed", top: filtersPopoverPos.top, right: filtersPopoverPos.right, zIndex: 200 }}>
      <div className="timeline-filters-popover-section">
        <span className="toolbar-label">Zoom</span>
        <div className="toolbar-group" style={{ flex: 1 }}>
          <input max={2.5} min={0.8} step={0.1} style={{ flex: 1 }} type="range" value={zoom} onChange={(event) => onZoomChange(Number(event.target.value))}/>
          <span className="toolbar-value">{zoom.toFixed(1)}×</span>
        </div>
      </div>

      <div className="timeline-filters-popover-divider"/>

      <div className="timeline-filters-popover-section" style={{ flexWrap: "wrap" }}>
        <button className={`filter-chip all-toggle${activeLaneCount === totalLaneCount ? " active" : ""}`} type="button" onClick={() => {
            const allOn = activeLaneCount === totalLaneCount;
            const next = Object.fromEntries(TIMELINE_LANES.map((lane) => [lane, !allOn])) as Record<TimelineLane, boolean>;
            setFilters(next);
        }}>
          {activeLaneCount === totalLaneCount ? "All" : `${activeLaneCount}/${totalLaneCount}`}
        </button>
        {TIMELINE_LANES.map((lane) => (<label key={lane} className={`filter-chip ${lane}${filters[lane] ? " active" : ""}`}>
            <input checked={filters[lane]} type="checkbox" onChange={() => setFilters((current) => ({ ...current, [lane]: !current[lane] }))}/>
            <span className="filter-dot"/>
            {getLaneTheme(lane).label}
          </label>))}
      </div>
    </div>);
}
function TimelineTaskControlsPanel({ controlsPopoverRef, controlsPopoverPos, isEditingTaskTitle, onSubmitTitle, isSavingTaskTitle, onTitleDraftChange, taskTitleDraft, onCancelEditTitle, taskTitleError, onStartEditTitle, onOpenTaskWorkspace, taskStatus, onChangeTaskStatus, isUpdatingTaskStatus, observabilityStats }: {
    readonly controlsPopoverRef: React.RefObject<HTMLDivElement | null>;
    readonly controlsPopoverPos: {
        top: number;
        right: number;
    };
    readonly isEditingTaskTitle: boolean;
    readonly onSubmitTitle: (event: ReactFormEvent<HTMLFormElement>) => void;
    readonly isSavingTaskTitle: boolean;
    readonly onTitleDraftChange: (value: string) => void;
    readonly taskTitleDraft: string;
    readonly onCancelEditTitle: () => void;
    readonly taskTitleError: string | null;
    readonly onStartEditTitle: () => void;
    readonly onOpenTaskWorkspace: (() => void) | undefined;
    readonly taskStatus: TimelineProps["taskStatus"] | undefined;
    readonly onChangeTaskStatus: ((status: "running" | "waiting" | "completed" | "errored") => void) | undefined;
    readonly isUpdatingTaskStatus: boolean | undefined;
    readonly observabilityStats: TimelineObservabilityStats;
}): React.JSX.Element {
    const observabilityBadges = [
        { key: "actions", label: "Actions", value: observabilityStats.actions },
        { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities },
        { key: "files", label: "Files", value: observabilityStats.exploredFiles },
        { key: "compacts", label: "Compact", value: observabilityStats.compactions },
        { key: "checks", label: "Checks", value: observabilityStats.checks },
        { key: "violations", label: "Violations", value: observabilityStats.violations },
        { key: "passes", label: "Passes", value: observabilityStats.passes }
    ] as const;

    return (<div ref={controlsPopoverRef} className="timeline-task-controls-panel" style={{ position: "fixed", top: controlsPopoverPos.top, right: controlsPopoverPos.right, zIndex: 200, minWidth: 260 }}>
      {isEditingTaskTitle ? (<form className="task-title-form" onSubmit={onSubmitTitle}>
          <div className="task-title-form-row">
            <input className="task-title-input" disabled={isSavingTaskTitle} onChange={(event) => onTitleDraftChange(event.target.value)} placeholder="Rename task" type="text" value={taskTitleDraft}/>
            <div className="task-title-actions">
              <Button className="h-7 rounded-full border-[var(--accent)] bg-[var(--accent-light)] px-3 text-[0.72rem] font-semibold text-[var(--accent)] shadow-none hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]" disabled={isSavingTaskTitle} size="sm" type="submit">
                {isSavingTaskTitle ? "Saving..." : "Save"}
              </Button>
              <Button className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none" disabled={isSavingTaskTitle} onClick={onCancelEditTitle} size="sm" type="button">
                Cancel
              </Button>
            </div>
          </div>
          {taskTitleError && <p className="task-title-error">{taskTitleError}</p>}
        </form>) : (<div className="timeline-task-controls-row">
          <div className="timeline-title-actions">
            <Button className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none" onClick={onStartEditTitle} size="sm" type="button">
              Rename Task
            </Button>
            {onOpenTaskWorkspace && (<Button className="h-7 rounded-full px-3 text-[0.72rem] font-semibold shadow-none" onClick={onOpenTaskWorkspace} size="sm" type="button">
                Open Workspace
              </Button>)}
          </div>
        </div>)}
      {!isEditingTaskTitle && taskStatus && onChangeTaskStatus && (<div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Status</span>
          <select className="h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[0.74rem] font-semibold text-[var(--text-2)]" disabled={isUpdatingTaskStatus} onChange={(event) => onChangeTaskStatus(event.target.value as "running" | "waiting" | "completed" | "errored")} value={taskStatus}>
            {(["running", "waiting", "completed", "errored"] as const).map((status) => (<option key={status} value={status}>{formatTaskStatusLabel(status)}</option>))}
          </select>
        </div>)}
      <div className="timeline-task-badges">
        {observabilityBadges.map((badge) => (<div key={badge.key} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.72rem] font-semibold tracking-[0.02em]", OBSERVABILITY_BADGE_STYLES[badge.key])}>
            <span className="text-[0.78rem] font-bold leading-none">{badge.value}</span>
            <span className="leading-none">{badge.label}</span>
          </div>))}
      </div>
    </div>);
}
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
    readonly onOpenTaskWorkspace?: () => void;
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
    return Math.max(0, Math.min(maxScrollLeft, input.timelineFocusRight - input.clientWidth + rightPadding));
}
export function Timeline({ timeline, taskTitle, taskId, taskStatus, taskUpdatedAt, taskUsesDerivedTitle, isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus = false, selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly, nowMs, observabilityStats, onSelectEvent, onSelectConnector, onStartEditTitle, onCancelEditTitle, onSubmitTitle, onTitleDraftChange, onToggleRuleGap, onClearRuleId, onClearTag, onOpenTaskWorkspace, onChangeTaskStatus, zoom, onZoomChange, }: TimelineProps): React.JSX.Element {
    const [filters, setFilters] = useState<Record<TimelineLane, boolean>>({
        user: true, exploration: true, planning: true, coordination: true, background: true,
        implementation: true, questions: true, todos: true
    });
    const [expandedSubtypeLanes, setExpandedSubtypeLanes] = useState<Record<ExpandableTimelineLane, boolean>>({
        exploration: false,
        implementation: false,
        coordination: false
    });
    const [isTimelineDragging, setIsTimelineDragging] = useState(false);
    const [nodeBounds, setNodeBounds] = useState<Record<string, NodeBounds>>({});
    const [isTaskControlsOpen, setIsTaskControlsOpen] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [filtersPopoverPos, setFiltersPopoverPos] = useState({ top: 0, right: 0 });
    const [controlsPopoverPos, setControlsPopoverPos] = useState({ top: 0, right: 0 });
    const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const nodeRefs = useRef(new Map<string, HTMLElement>());
    const isFollowing = useRef(true);
    const previousTaskId = useRef<string | null | undefined>(taskId);
    const lastScrolledEventId = useRef<string | null>(null);
    const filtersPopoverRef = useRef<HTMLDivElement>(null);
    const filtersButtonRef = useRef<HTMLButtonElement>(null);
    const controlsButtonRef = useRef<HTMLButtonElement>(null);
    const controlsPopoverRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{
        readonly pointerId: number;
        readonly startX: number;
        readonly startY: number;
        readonly scrollLeft: number;
        readonly scrollTop: number;
    } | null>(null);
    const anchorMs = useMemo(() => {
        if (!taskStatus || taskStatus === "running")
            return nowMs;
        return taskUpdatedAt ? Date.parse(taskUpdatedAt) : nowMs;
    }, [taskStatus, taskUpdatedAt, nowMs]);
    const activeBaseLanes = useMemo(() => TIMELINE_LANES.filter((l) => filters[l]), [filters]);
    const filteredTimeline = useMemo(() => filterTimelineEvents(timeline, {
        laneFilters: filters,
        selectedRuleId,
        selectedTag,
        showRuleGapsOnly
    }), [filters, selectedRuleId, selectedTag, showRuleGapsOnly, timeline]);
    const expandedLaneSet = useMemo(() => {
        const active = Object.entries(expandedSubtypeLanes)
            .filter(([, enabled]) => enabled)
            .map(([lane]) => lane as ExpandableTimelineLane);
        return new Set<ExpandableTimelineLane>(active);
    }, [expandedSubtypeLanes]);
    const displayLaneRows = useMemo(() => buildDisplayLaneRows(filteredTimeline, activeBaseLanes, expandedLaneSet), [activeBaseLanes, expandedLaneSet, filteredTimeline]);
    const laneSubtypeCounts = useMemo(() => ({
        exploration: countLaneSubtypes(filteredTimeline, "exploration"),
        implementation: countLaneSubtypes(filteredTimeline, "implementation"),
        coordination: countLaneSubtypes(filteredTimeline, "coordination")
    }), [filteredTimeline]);
    const firstExpandedSubtypeRowByLane = useMemo(() => {
        const entries = new Map<ExpandableTimelineLane, string>();
        for (const row of displayLaneRows) {
            if (!row.isSubtype)
                continue;
            const lane = row.baseLane;
            if (!isExpandableLane(lane) || entries.has(lane))
                continue;
            entries.set(lane, row.key);
        }
        return entries;
    }, [displayLaneRows]);
    const hasExpandedSubtypeRows = useMemo(() => displayLaneRows.some((row) => row.isSubtype), [displayLaneRows]);
    const timelineLeftGutter = hasExpandedSubtypeRows ? 236 : 212;
    const laneLabelWidth = hasExpandedSubtypeRows ? 212 : 188;
    const timelineStageStyle = useMemo(() => ({
        "--timeline-left-gutter": `${timelineLeftGutter}px`,
        "--timeline-lane-label-width": `${laneLabelWidth}px`,
        "--timeline-track-left": `${Math.max(96, timelineLeftGutter - 16)}px`,
        "--timeline-gutter-scrim-width": `${timelineLeftGutter + 28}px`
    }) as React.CSSProperties, [laneLabelWidth, timelineLeftGutter]);
    const canvasHeight = RULER_HEIGHT + displayLaneRows.length * LANE_HEIGHT;
    const timelineLayout = useMemo(() => buildTimelineLayout(filteredTimeline, zoom, anchorMs, displayLaneRows, { leftGutter: timelineLeftGutter }), [filteredTimeline, zoom, anchorMs, displayLaneRows, timelineLeftGutter]);
    const timestampTicks = useMemo(() => buildTimestampTicks(filteredTimeline, timelineLayout, anchorMs), [filteredTimeline, timelineLayout, anchorMs]);
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
                if (!node)
                    continue;
                const rect = node.getBoundingClientRect();
                nextBounds[item.event.id] = {
                    left: rect.left - canvasRect.left,
                    top: rect.top - canvasRect.top,
                    width: rect.width,
                    height: rect.height
                };
            }
            setNodeBounds((current) => (areNodeBoundsEqual(current, nextBounds) ? current : nextBounds));
        }
        measureNodes();
        const frame = requestAnimationFrame(measureNodes);
        const observer = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => measureNodes());
        observer?.observe(canvas);
        for (const item of timelineLayout.items) {
            const node = nodeRefs.current.get(item.event.id);
            if (node)
                observer?.observe(node);
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
        if (!el || !isFollowing.current)
            return;
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
        if (!shouldReset)
            return;
        isFollowing.current = true;
        const el = scrollRef.current;
        if (!el)
            return;
        el.scrollLeft = computeTimelineFollowScrollLeft({
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            timelineFocusRight
        });
    }, [filteredTimeline, selectedEventId, taskId, timelineFocusRight]);
    useEffect(() => {
        if (!selectedEventId)
            return;
        if (lastScrolledEventId.current === selectedEventId)
            return;
        const el = scrollRef.current;
        if (!el)
            return;
        const item = timelineLayout.items.find((i) => i.event.id === selectedEventId);
        if (!item)
            return;
        lastScrolledEventId.current = selectedEventId;
        const nodeCenter = item.left + NODE_WIDTH / 2;
        const targetScroll = nodeCenter - el.clientWidth / 2;
        el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, targetScroll));
        isFollowing.current = false;
    }, [selectedEventId, timelineLayout.items]);
    const selectedConnector = useMemo(() => {
        if (!selectedConnectorKey)
            return null;
        const connector = connectors.find((item) => item.key === selectedConnectorKey);
        if (!connector)
            return null;
        const source = filteredTimeline.find((event) => event.id === connector.sourceEventId);
        const target = filteredTimeline.find((event) => event.id === connector.targetEventId);
        if (!source || !target)
            return null;
        return { connector, source, target };
    }, [connectors, filteredTimeline, selectedConnectorKey]);
    const selectedEvent = selectedConnector
        ? null
        : filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[filteredTimeline.length - 1] ?? null;
    const contextSummary = useMemo(() => buildTimelineContextSummary({
        filteredEventCount: filteredTimeline.length,
        totalEventCount: timeline.length,
        activeLaneCount: activeBaseLanes.length,
        totalLaneCount: TIMELINE_LANES.length,
        selectedRuleId,
        selectedTag,
        showRuleGapsOnly
    }), [activeBaseLanes.length, filteredTimeline.length, selectedRuleId, selectedTag, showRuleGapsOnly, timeline.length]);
    const stackGroups = useMemo(() => {
        const map = new Map<string, readonly TimelineItemLayout[]>();
        for (const frontItem of timelineLayout.items) {
            if (frontItem.rowIndex !== 0)
                continue;
            const group = timelineLayout.items.filter((other) => other.laneKey === frontItem.laneKey &&
                Math.abs(other.left - frontItem.left) < NODE_WIDTH);
            if (group.length > 1)
                map.set(frontItem.event.id, group);
        }
        return map;
    }, [timelineLayout.items]);
    const [openStackEventId, setOpenStackEventId] = useState<string | null>(null);
    useEffect(() => {
        if (!openStackEventId)
            return;
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape")
                setOpenStackEventId(null);
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
        if (isEditingTaskTitle && !isTaskControlsOpen) {
            setIsTaskControlsOpen(true);
        }
    }, [isEditingTaskTitle, isTaskControlsOpen]);
    useEffect(() => {
        if (!isFiltersOpen && !isTaskControlsOpen)
            return;
        const handleMouse = (e: MouseEvent): void => {
            const t = e.target as Node;
            if (isFiltersOpen && filtersPopoverRef.current && !filtersPopoverRef.current.contains(t) && filtersButtonRef.current && !filtersButtonRef.current.contains(t)) {
                setIsFiltersOpen(false);
            }
            if (isTaskControlsOpen && controlsPopoverRef.current && !controlsPopoverRef.current.contains(t) && controlsButtonRef.current && !controlsButtonRef.current.contains(t)) {
                setIsTaskControlsOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                setIsFiltersOpen(false);
                setIsTaskControlsOpen(false);
            }
        };
        window.addEventListener("mousedown", handleMouse);
        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("mousedown", handleMouse);
            window.removeEventListener("keydown", handleKey);
        };
    }, [isFiltersOpen, isTaskControlsOpen]);
    return (<section className="flex h-full min-h-0 flex-col">
      

      <div className="timeline-panel">
        
        <TimelineContextBar taskTitle={taskTitle} taskUsesDerivedTitle={taskUsesDerivedTitle} contextSummary={contextSummary} showRuleGapsOnly={showRuleGapsOnly} onToggleRuleGap={onToggleRuleGap} selectedRuleId={selectedRuleId} onClearRuleId={onClearRuleId} selectedTag={selectedTag} onClearTag={onClearTag} observabilityStats={observabilityStats} taskStatus={taskStatus} isTaskControlsOpen={isTaskControlsOpen} isEditingTaskTitle={isEditingTaskTitle} controlsButtonRef={controlsButtonRef} setControlsPopoverPos={setControlsPopoverPos} setIsTaskControlsOpen={setIsTaskControlsOpen} isFiltersOpen={isFiltersOpen} filtersButtonRef={filtersButtonRef} setFiltersPopoverPos={setFiltersPopoverPos} setIsFiltersOpen={setIsFiltersOpen} activeLaneCount={activeBaseLanes.length} totalLaneCount={TIMELINE_LANES.length}/>

        
        {isFiltersOpen && (<TimelineFiltersPopover filtersPopoverRef={filtersPopoverRef} filtersPopoverPos={filtersPopoverPos} zoom={zoom} onZoomChange={onZoomChange} activeLaneCount={activeBaseLanes.length} totalLaneCount={TIMELINE_LANES.length} filters={filters} setFilters={setFilters}/>)}

        
        {(isTaskControlsOpen || isEditingTaskTitle) && (<TimelineTaskControlsPanel controlsPopoverRef={controlsPopoverRef} controlsPopoverPos={controlsPopoverPos} isEditingTaskTitle={isEditingTaskTitle} onSubmitTitle={onSubmitTitle} isSavingTaskTitle={isSavingTaskTitle} onTitleDraftChange={onTitleDraftChange} taskTitleDraft={taskTitleDraft} onCancelEditTitle={onCancelEditTitle} taskTitleError={taskTitleError} onStartEditTitle={onStartEditTitle} onOpenTaskWorkspace={onOpenTaskWorkspace} taskStatus={taskStatus} onChangeTaskStatus={onChangeTaskStatus} isUpdatingTaskStatus={isUpdatingTaskStatus} observabilityStats={observabilityStats}/>)}

        <div className="timeline-stage" style={timelineStageStyle}>
          {filteredTimeline.length === 0 && (<div className="timeline-empty-state">
              <p>No events yet</p>
              <span>Timeline activity will appear here as the agent runs.</span>
            </div>)}
          <div className="timeline-edge-fade left"/>
          <div className="timeline-edge-fade right"/>
          <div className="timeline-gutter-scrim"/>
          <div className={`timeline-scroll${isTimelineDragging ? " is-dragging" : ""}`} ref={scrollRef} onScroll={(e) => {
            const el = e.currentTarget;
            isFollowing.current = el.scrollLeft + el.clientWidth >= timelineFocusRight + 24;
        }} onPointerDown={(e) => {
            if (e.button !== 0)
                return;
            const target = e.target as HTMLElement | null;
            if (target?.closest(".event-node, .connector-hitbox, button, input, label, a"))
                return;
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
        }} onPointerMove={(e) => {
            const current = dragState.current;
            if (!current || current.pointerId !== e.pointerId)
                return;
            const dx = e.clientX - current.startX;
            const dy = e.clientY - current.startY;
            e.currentTarget.scrollLeft = current.scrollLeft - dx;
            e.currentTarget.scrollTop = current.scrollTop - dy;
        }} onPointerUp={(e) => {
            if (dragState.current?.pointerId !== e.pointerId)
                return;
            dragState.current = null;
            setIsTimelineDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }} onPointerCancel={(e) => {
            if (dragState.current?.pointerId !== e.pointerId)
                return;
            dragState.current = null;
            setIsTimelineDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }} style={{
            cursor: isTimelineDragging ? "grabbing" : "grab"
        }}>
            <div className="timeline-canvas" ref={timelineCanvasRef} style={{ width: `${timelineLayout.width}px`, minHeight: `${canvasHeight}px` }}>

              
              <svg className="timeline-overlay" style={{ width: timelineLayout.width, height: canvasHeight }} xmlns="http://www.w3.org/2000/svg">
                <title>Timeline overlay</title>
                <defs>
                  {TIMELINE_LANES.map((lane) => ((() => {
            return (<marker key={lane} id={`arrow-${lane}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                          <polygon points="0 0, 6 2, 0 4" className={`arrow-tip ${lane}`}/>
                        </marker>);
        })()))}
                </defs>

                
                <rect x="0" y="0" width={timelineLayout.width} height={RULER_HEIGHT} className="ruler-bg"/>
                <line x1="0" y1={RULER_HEIGHT} x2={timelineLayout.width} y2={RULER_HEIGHT} className="ruler-baseline"/>

                
                {timestampTicks.map((tick) => (<g key={tick.label + tick.x}>
                    <line x1={tick.x} y1={RULER_HEIGHT - 6} x2={tick.x} y2={RULER_HEIGHT} className="ruler-tick"/>
                    <text x={tick.x + 4} y={RULER_HEIGHT - 8} className="ruler-label">
                      {tick.label}
                    </text>
                    <line x1={tick.x} y1={RULER_HEIGHT} x2={tick.x} y2={canvasHeight} className="grid-line"/>
                  </g>))}

                
                {connectors.filter((c) => c.cross).map((c) => (<g key={c.key}>
                    <path d={c.path} className={`connector-hitbox${selectedConnector?.connector.key === c.key ? " active" : ""}`} onClick={() => onSelectConnector(c.key)}/>
                    <path d={c.path} className={`connector ${c.lane} cross-lane${selectedConnector?.connector.key === c.key ? " active" : ""}`} onClick={() => onSelectConnector(c.key)}/>
                  </g>))}
                
                {connectors.filter((c) => !c.cross).map((c) => (<g key={c.key}>
                    <path d={c.path} className={`connector-hitbox${selectedConnector?.connector.key === c.key ? " active" : ""}`} onClick={() => onSelectConnector(c.key)}/>
                    <path d={c.path} className={`connector ${c.lane}${selectedConnector?.connector.key === c.key ? " active" : ""}`} markerEnd={`url(#arrow-${c.lane})`} onClick={() => onSelectConnector(c.key)}/>
                  </g>))}
              </svg>

              
              {displayLaneRows.map((row, index) => ((() => {
            const laneTheme = getLaneTheme(row.baseLane);
            const expandableLane = isExpandableLane(row.baseLane) ? row.baseLane : null;
            const subtypeCount = expandableLane ? laneSubtypeCounts[expandableLane] : 0;
            const isExpanded = expandableLane ? expandedSubtypeLanes[expandableLane] : false;
            const showExpandButton = Boolean(expandableLane && !row.isSubtype && subtypeCount > 0);
            const showCollapseButton = Boolean(expandableLane
                && row.isSubtype
                && firstExpandedSubtypeRowByLane.get(expandableLane) === row.key);
            return (<div key={row.key} className={cn("lane-row", index % 2 === 1 && "striped")} style={{ top: `${RULER_HEIGHT + index * LANE_HEIGHT}px` }}>
                      <div className={cn("lane-label", row.baseLane, row.isSubtype && "subtype")} title={row.isSubtype ? `${laneTheme.label} • ${row.subtypeLabel}` : laneTheme.description}>
                        <img className={`lane-icon ${row.baseLane}`} src={laneTheme.icon} alt=""/>
                        <span className="lane-label-copy">
                          <span>{row.isSubtype ? row.subtypeLabel : laneTheme.label}</span>
                          {row.isSubtype && <span className="lane-subtype-parent">{laneTheme.label}</span>}
                        </span>
                        {showExpandButton && (<button className={cn("lane-expand-toggle", row.baseLane, isExpanded && "active")} onClick={(event) => {
                        event.stopPropagation();
                        setExpandedSubtypeLanes((current) => ({
                            ...current,
                            [expandableLane!]: !current[expandableLane!]
                        }));
                    }} title={`${laneTheme.label} details`} type="button">
                            <span className="lane-expand-count">{subtypeCount}</span>
                            <span>{isExpanded ? "▾" : "▸"}</span>
                          </button>)}
                        {showCollapseButton && (<button className={cn("lane-expand-toggle", row.baseLane, "active")} onClick={(event) => {
                        event.stopPropagation();
                        setExpandedSubtypeLanes((current) => ({
                            ...current,
                            [expandableLane!]: false
                        }));
                    }} title={`Fold ${laneTheme.label} details`} type="button">
                            <span>▾</span>
                          </button>)}
                      </div>
                      <div className="lane-track"/>
                      <div className="lane-separator"/>
                    </div>);
        })()))}

              
              <div className="now-line" style={{ left: `${timelineLayout.nowLeft}px`, top: `${RULER_HEIGHT}px` }}>
                <span className="now-label">now</span>
              </div>

              
              {[...timelineLayout.items]
            .sort((a, b) => b.rowIndex - a.rowIndex)
            .map((item) => ((() => {
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
            const subtype = resolveEventSubtype(item.event);
            const stackGroup = stackGroups.get(item.event.id);
            const stackCount = stackGroup ? stackGroup.length - 1 : 0;
            const nodeTop = item.top + item.rowIndex * ROW_VERTICAL_OFFSET;
            return (<div key={item.event.id} role="button" tabIndex={0} className={cn(`event-node ${item.baseLane} kind-${item.event.kind.replace(/\./g, "-")}`, item.event.id === selectedEvent?.id && "active", selectedConnector && (item.event.id === selectedConnector.source.id || item.event.id === selectedConnector.target.id) && "linked", item.rowIndex > 0 && "stacked-behind")} onClick={() => {
                    onSelectEvent(item.event.id);
                    setOpenStackEventId(null);
                }} onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectEvent(item.event.id);
                        setOpenStackEventId(null);
                    }
                }} ref={(node) => {
                    if (node) {
                        nodeRefs.current.set(item.event.id, node);
                        return;
                    }
                    nodeRefs.current.delete(item.event.id);
                }} style={{ left: `${item.left}px`, top: `${nodeTop}px` }}>
                        <div className="event-node-header">
                          <span className="event-node-dot"/>
                          <span className="event-lane-tag">{item.baseLane}</span>
                          {subtype?.icon && (<span aria-label={subtype.label} className="text-[0.75rem] opacity-70 select-none leading-none" role="img" title={subtype.label}>
                              {subtype.icon}
                            </span>)}
                          {stackCount > 0 && (<button className="stack-badge-btn" title={`${stackCount + 1}개 이벤트 겹침 — 클릭해서 모두 보기`} type="button" onClick={(e) => {
                        e.stopPropagation();
                        setOpenStackEventId(openStackEventId === item.event.id ? null : item.event.id);
                    }}>
                              +{stackCount}
                            </button>)}
                        </div>
                        <strong>{item.event.kind === "task.start" ? (taskTitle ?? item.event.title) : item.event.title}</strong>
                        <div className="event-node-chips">
                          {subtype && <span className="event-semantic-tag">{subtype.label}</span>}
                          {activityType && <span className="event-semantic-tag">{activityType.replace(/_/g, " ")}</span>}
                          {relationLabel && <span className="event-semantic-tag subtle">{relationLabel}</span>}
                          {agentName && <span className="event-semantic-tag subtle">{agentName}</span>}
                          {skillName && <span className="event-semantic-tag subtle">skill:{skillName}</span>}
                          {!skillName && mcpTool && <span className="event-semantic-tag subtle">mcp:{mcpTool}</span>}
                          {workItemId && <span className="event-semantic-tag subtle">work:{workItemId}</span>}
                        </div>
                        {item.event.kind === "assistant.response" && (<span className="event-semantic-tag">response</span>)}
                        {item.event.kind === "question.logged" && questionPhase && (<span className="event-semantic-tag">{questionPhase}</span>)}
                        {item.event.kind === "todo.logged" && todoState && (<span className="event-semantic-tag">{todoState.replace("_", " ")}</span>)}
                        <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
                      </div>);
        })()))}

              
              {openStackEventId && (() => {
            const frontItem = timelineLayout.items.find((i) => i.event.id === openStackEventId);
            if (!frontItem)
                return null;
            const group = stackGroups.get(openStackEventId);
            if (!group)
                return null;
            const bounds = nodeBounds[openStackEventId];
            if (!bounds)
                return null;
            const popoverLeft = bounds.left;
            const popoverTop = bounds.top + bounds.height + 6;
            const sortedGroup = [...group].sort((a, b) => Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt));
            return (<div className="stack-popover" style={{ left: `${popoverLeft}px`, top: `${popoverTop}px` }}>
                    <div className="stack-popover-header">
                      {group.length}개 이벤트 겹침
                    </div>
                    {sortedGroup.map((groupItem) => {
                    const gt = getLaneTheme(groupItem.baseLane);
                    return (<button key={groupItem.event.id} className={cn("stack-popover-item", groupItem.baseLane, groupItem.event.id === selectedEvent?.id && "active")} type="button" onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(groupItem.event.id);
                            setOpenStackEventId(null);
                        }}>
                          <img className={`stack-item-icon ${groupItem.baseLane}`} src={gt.icon} alt=""/>
                          <span className="stack-item-title">
                            {groupItem.event.kind === "task.start"
                            ? (taskTitle ?? groupItem.event.title)
                            : groupItem.event.title}
                          </span>
                          <span className="stack-item-time">{formatRelativeTime(groupItem.event.createdAt)}</span>
                        </button>);
                })}
                  </div>);
        })()}

            </div>
          </div>
        </div>

        {filteredTimeline.length > 0 && (<>
            <div className="timeline-visual-legend" role="note" aria-label="Timeline visual guide">
              <div className="timeline-visual-legend-item">
                <span className="timeline-visual-swatch viewport" aria-hidden="true"/>
                <span>Bottom minimap box = currently visible timeline range</span>
              </div>
            </div>
            <TimelineMinimap timelineWidth={timelineLayout.width} canvasHeight={canvasHeight} items={timelineLayout.items} laneRows={displayLaneRows} scrollRef={scrollRef}/>
          </>)}

      </div>
    </section>);
}
interface MinimapProps {
    readonly timelineWidth: number;
    readonly canvasHeight: number;
    readonly items: readonly TimelineItemLayout[];
    readonly laneRows: readonly TimelineLaneRow[];
    readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}
const GAP_THRESHOLD_RATIO = 0.10;
const GAP_DISPLAY_FRACTION = 0.03;
interface MapSegment {
    readonly realStart: number;
    readonly realEnd: number;
    readonly mapStart: number;
    readonly mapEnd: number;
    readonly isGap: boolean;
}
function buildCompressedMap(sortedLefts: readonly number[], totalWidth: number): readonly MapSegment[] {
    const threshold = totalWidth * GAP_THRESHOLD_RATIO;
    const gapIntervals: Array<[
        number,
        number
    ]> = [];
    for (let i = 0; i < sortedLefts.length - 1; i++) {
        const gap = (sortedLefts[i + 1] ?? 0) - (sortedLefts[i] ?? 0);
        if (gap > threshold)
            gapIntervals.push([sortedLefts[i] ?? 0, sortedLefts[i + 1] ?? 0]);
    }
    if (gapIntervals.length === 0) {
        return [{ realStart: 0, realEnd: totalWidth, mapStart: 0, mapEnd: 1, isGap: false }];
    }
    const rawSegments: Array<{
        start: number;
        end: number;
        isGap: boolean;
    }> = [];
    let cursor = 0;
    for (const [gStart, gEnd] of gapIntervals) {
        if (cursor < gStart)
            rawSegments.push({ start: cursor, end: gStart, isGap: false });
        rawSegments.push({ start: gStart, end: gEnd, isGap: true });
        cursor = gEnd;
    }
    if (cursor < totalWidth)
        rawSegments.push({ start: cursor, end: totalWidth, isGap: false });
    const nGaps = gapIntervals.length;
    const totalContentReal = rawSegments
        .filter(s => !s.isGap)
        .reduce((sum, s) => sum + (s.end - s.start), 0);
    const contentDisplayTotal = Math.max(0.01, 1 - nGaps * GAP_DISPLAY_FRACTION);
    const result: MapSegment[] = [];
    let mapCursor = 0;
    for (const seg of rawSegments) {
        const realLen = seg.end - seg.start;
        const mapLen = seg.isGap
            ? GAP_DISPLAY_FRACTION
            : (realLen / Math.max(1, totalContentReal)) * contentDisplayTotal;
        result.push({ realStart: seg.start, realEnd: seg.end, mapStart: mapCursor, mapEnd: mapCursor + mapLen, isGap: seg.isGap });
        mapCursor += mapLen;
    }
    return result;
}
function realToCompressed(realPx: number, segments: readonly MapSegment[]): number {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (realPx <= seg.realEnd || i === segments.length - 1) {
            const span = seg.realEnd - seg.realStart;
            const t = span > 0 ? (realPx - seg.realStart) / span : 0;
            return seg.mapStart + t * (seg.mapEnd - seg.mapStart);
        }
    }
    return 1;
}
function compressedToReal(ratio: number, segments: readonly MapSegment[]): number {
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        if (ratio <= seg.mapEnd || i === segments.length - 1) {
            const span = seg.mapEnd - seg.mapStart;
            const t = span > 1e-9 ? (ratio - seg.mapStart) / span : 0;
            return seg.realStart + t * (seg.realEnd - seg.realStart);
        }
    }
    return segments[segments.length - 1]?.realEnd ?? 1;
}
function TimelineMinimap({ timelineWidth, items, laneRows, scrollRef }: MinimapProps): React.JSX.Element | null {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({ left: 0, viewWidth: 0, totalWidth: 1 });
    const isDragging = useRef(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
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
    const sortedLefts = useMemo(() => [...items].map(i => i.left).sort((a, b) => a - b), [items]);
    const segments = useMemo(() => buildCompressedMap(sortedLefts, timelineWidth), [sortedLefts, timelineWidth]);
    const scrubToClientX = (clientX: number): void => {
        const container = containerRef.current;
        const scrollEl = scrollRef.current;
        if (!container || !scrollEl)
            return;
        const rect = container.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const realPx = compressedToReal(ratio, segments);
        const target = (realPx / timelineWidth) * scrollState.totalWidth - scrollState.viewWidth / 2;
        scrollEl.scrollLeft = Math.max(0, Math.min(scrollState.totalWidth - scrollState.viewWidth, target));
    };
    const laneCount = laneRows.length;
    const viewportRealLeft = (scrollState.left / scrollState.totalWidth) * timelineWidth;
    const viewportRealRight = viewportRealLeft + (scrollState.viewWidth / scrollState.totalWidth) * timelineWidth;
    const viewportLeftPct = realToCompressed(viewportRealLeft, segments) * 100;
    const viewportWidthPct = (realToCompressed(viewportRealRight, segments) - realToCompressed(viewportRealLeft, segments)) * 100;
    if (laneCount === 0 || timelineWidth === 0)
        return null;
    return (<div ref={containerRef} className="timeline-minimap" role="scrollbar" aria-label="Timeline minimap" aria-valuenow={Math.round(viewportLeftPct)} onPointerDown={(e) => {
            isDragging.current = true;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            scrubToClientX(e.clientX);
            e.preventDefault();
        }} onPointerMove={(e) => {
            if (!isDragging.current)
                return;
            scrubToClientX(e.clientX);
        }} onPointerUp={(e) => {
            isDragging.current = false;
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }} onPointerCancel={(e) => {
            isDragging.current = false;
            (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        }}>
      
      {laneRows.map((row, i) => (<div key={row.key} className={`minimap-lane ${row.baseLane}`} style={{
                top: `${(i / laneCount) * 100}%`,
                height: `${(1 / laneCount) * 100}%`
            }}/>))}

      
      {segments.filter(s => s.isGap).map((seg, i) => (<div key={i} className="minimap-gap" style={{ left: `${seg.mapStart * 100}%`, width: `${(seg.mapEnd - seg.mapStart) * 100}%` }}/>))}

      
      {items.map((item) => {
            const laneIndex = laneRows.findIndex((row) => row.key === item.laneKey);
            if (laneIndex < 0)
                return null;
            const leftPct = realToCompressed(item.left, segments) * 100;
            const topPct = ((laneIndex + 0.5) / laneCount) * 100;
            return (<div key={item.event.id} className={`minimap-dot ${item.baseLane}`} style={{ left: `${leftPct}%`, top: `${topPct}%` }}/>);
        })}

      
      <div className="minimap-viewport" style={{ left: `${viewportLeftPct}%`, width: `${Math.max(viewportWidthPct, 2)}%` }} title="Currently visible timeline range"/>
    </div>);
}
export type { NodeBounds };
export { areNodeBoundsEqual };
