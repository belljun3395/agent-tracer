import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildDisplayLaneRows, buildTimelineContextSummary, buildTimelineConnectors, buildTimelineLayout, buildTimestampTicks, countLaneSubtypes, filterTimelineEvents, formatRelativeTime, isExpandableLane, LANE_HEIGHT, NODE_WIDTH, resolveEventSubtype, ROW_VERTICAL_OFFSET, RULER_HEIGHT, TIMELINE_LANES, type ExpandableTimelineLane, type TimelineItemLayout, type TimelineLane, type TimelineNodeBounds } from "@monitor/web-domain";
import { cn } from "../lib/ui/cn.js";
import { getLaneTheme } from "../lib/ui/laneTheme.js";
import { TimelineMinimap } from "../features/timeline/TimelineMinimap.js";
import { TimelineContextBar } from "../features/timeline/TimelineContextBar.js";
import { TimelineFiltersPopover } from "../features/timeline/TimelineFiltersPopover.js";
import { TimelineTaskControlsPanel } from "../features/timeline/TimelineTaskControlsPanel.js";
import { areNodeBoundsEqual, type NodeBounds } from "../features/timeline/utils.js";
import { shouldResetTimelineFollowForTaskChange, computeTimelineFollowScrollLeft } from "../features/timeline/useTimelineFollow.js";
import type { TimelineProps } from "../features/timeline/types.js";
import "./Timeline.css";

export function Timeline({ timeline, taskTitle, taskId, taskStatus, taskUpdatedAt, taskUsesDerivedTitle, isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus = false, selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly, nowMs, observabilityStats, onSelectEvent, onSelectConnector, onStartEditTitle, onCancelEditTitle, onSubmitTitle, onTitleDraftChange, onToggleRuleGap, onClearRuleId, onClearTag, onOpenTaskWorkspace, onChangeTaskStatus, zoom, onZoomChange, embedded, externalControlsState, externalFiltersState, }: TimelineProps): React.JSX.Element {
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
    const [localIsTaskControlsOpen, setLocalIsTaskControlsOpen] = useState(false);
    const [localIsFiltersOpen, setLocalIsFiltersOpen] = useState(false);
    const [localFiltersPopoverPos, setLocalFiltersPopoverPos] = useState({ top: 0, right: 0 });
    const [localControlsPopoverPos, setLocalControlsPopoverPos] = useState({ top: 0, right: 0 });
    const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const nodeRefs = useRef(new Map<string, HTMLElement>());
    const isFollowing = useRef(true);
    const previousTaskId = useRef<string | null | undefined>(taskId);
    const lastScrolledEventId = useRef<string | null>(null);
    const filtersPopoverRef = useRef<HTMLDivElement>(null);
    const localFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const localControlsButtonRef = useRef<HTMLButtonElement>(null);
    const controlsPopoverRef = useRef<HTMLDivElement>(null);
    // When external state is provided (embedded mode), use it; otherwise use local state
    const isTaskControlsOpen = externalControlsState?.isOpen ?? localIsTaskControlsOpen;
    const setIsTaskControlsOpen = externalControlsState?.setIsOpen ?? setLocalIsTaskControlsOpen;
    const controlsPopoverPos = externalControlsState?.popoverPos ?? localControlsPopoverPos;
    const setControlsPopoverPos = externalControlsState?.setPopoverPos ?? setLocalControlsPopoverPos;
    const controlsButtonRef = externalControlsState?.buttonRef ?? localControlsButtonRef;
    const isFiltersOpen = externalFiltersState?.isOpen ?? localIsFiltersOpen;
    const setIsFiltersOpen = externalFiltersState?.setIsOpen ?? setLocalIsFiltersOpen;
    const filtersPopoverPos = externalFiltersState?.popoverPos ?? localFiltersPopoverPos;
    const setFiltersPopoverPos = externalFiltersState?.setPopoverPos ?? setLocalFiltersPopoverPos;
    const filtersButtonRef = externalFiltersState?.buttonRef ?? localFiltersButtonRef;
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

        {!embedded && (<TimelineContextBar taskTitle={taskTitle} taskUsesDerivedTitle={taskUsesDerivedTitle} contextSummary={contextSummary} showRuleGapsOnly={showRuleGapsOnly} onToggleRuleGap={onToggleRuleGap} selectedRuleId={selectedRuleId} onClearRuleId={onClearRuleId} selectedTag={selectedTag} onClearTag={onClearTag} observabilityStats={observabilityStats} taskStatus={taskStatus} isTaskControlsOpen={isTaskControlsOpen} isEditingTaskTitle={isEditingTaskTitle} controlsButtonRef={controlsButtonRef} setControlsPopoverPos={setControlsPopoverPos} setIsTaskControlsOpen={setIsTaskControlsOpen} isFiltersOpen={isFiltersOpen} filtersButtonRef={filtersButtonRef} setFiltersPopoverPos={setFiltersPopoverPos} setIsFiltersOpen={setIsFiltersOpen} activeLaneCount={activeBaseLanes.length} totalLaneCount={TIMELINE_LANES.length}/>)}


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
                        {showExpandButton && (<button aria-label={`Show ${subtypeCount} ${laneTheme.label} details`} className={cn("lane-expand-toggle", row.baseLane, isExpanded && "active")} onClick={(event) => {
                        event.stopPropagation();
                        setExpandedSubtypeLanes((current) => ({
                            ...current,
                            [expandableLane!]: !current[expandableLane!]
                        }));
                    }} title={`${laneTheme.label} details`} type="button">
                            <span className="lane-expand-count">{subtypeCount}</span>
                            <span className="lane-expand-label">details</span>
                            <span>{isExpanded ? "▾" : "▸"}</span>
                          </button>)}
                        {showCollapseButton && (<button aria-label={`Hide ${laneTheme.label} details`} className={cn("lane-expand-toggle", row.baseLane, "active")} onClick={(event) => {
                        event.stopPropagation();
                        setExpandedSubtypeLanes((current) => ({
                            ...current,
                            [expandableLane!]: false
                        }));
                    }} title={`Fold ${laneTheme.label} details`} type="button">
                            <span className="lane-expand-label">hide</span>
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
            const semanticChips = [
                subtype ? { label: subtype.label, subtle: false } : null,
                activityType ? { label: activityType.replace(/_/g, " "), subtle: false } : null,
                relationLabel ? { label: relationLabel, subtle: true } : null,
                agentName ? { label: agentName, subtle: true } : null,
                skillName ? { label: `skill:${skillName}`, subtle: true } : (!skillName && mcpTool ? { label: `mcp:${mcpTool}`, subtle: true } : null),
                workItemId ? { label: `work:${workItemId}`, subtle: true } : null,
                item.event.kind === "assistant.response" ? { label: "response", subtle: false } : null,
                item.event.kind === "question.logged" && questionPhase ? { label: questionPhase, subtle: false } : null,
                item.event.kind === "todo.logged" && todoState ? { label: todoState.replace("_", " "), subtle: false } : null
            ].filter((chip): chip is {
                readonly label: string;
                readonly subtle: boolean;
            } => chip !== null);
            const visibleSemanticChips = semanticChips.slice(0, 2);
            const hiddenSemanticChipCount = Math.max(semanticChips.length - visibleSemanticChips.length, 0);
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
                          {stackCount > 0 && (<button className="stack-badge-btn" aria-label={`${stackCount + 1} overlapping events`} title={`${stackCount + 1} overlapping events`} type="button" onClick={(e) => {
                        e.stopPropagation();
                        setOpenStackEventId(openStackEventId === item.event.id ? null : item.event.id);
                    }}>
                              +{stackCount}
                            </button>)}
                        </div>
                        <strong>{item.event.kind === "task.start" ? (taskTitle ?? item.event.title) : item.event.title}</strong>
                        <div className="event-node-meta">
                          <span className="event-time">{formatRelativeTime(item.event.createdAt)}</span>
                          {visibleSemanticChips.length > 0 && (<div className="event-node-chips">
                              {visibleSemanticChips.map((chip) => (<span key={chip.label} className={cn("event-semantic-tag", chip.subtle && "subtle")}>
                                  {chip.label}
                                </span>))}
                              {hiddenSemanticChipCount > 0 && <span className="event-semantic-tag subtle">+{hiddenSemanticChipCount}</span>}
                            </div>)}
                        </div>
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

export type { NodeBounds };
export { areNodeBoundsEqual };
export type { TimelineProps };
export { shouldResetTimelineFollowForTaskChange, computeTimelineFollowScrollLeft };
