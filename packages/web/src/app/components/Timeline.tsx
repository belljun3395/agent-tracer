import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { segmentEventsByTurn } from "~domain/segments.js";
import { filterEventsByGroup } from "~domain/turn-partition.js";
import { useContextWarningPrefs } from "../lib/useContextWarningPrefs.js";
import { buildDisplayLaneRows, countLaneSubtypes, isExpandableLane } from "~app/lib/eventSubtype.js";
import type { ExpandableTimelineLane } from "~app/lib/eventSubtype.js";
import { filterTimelineEvents } from "~app/lib/insights/extraction.js";
import { groupInstructionsBursts } from "~app/lib/instructionsBurst.js";
import { isContextHydrationEvent, selectSessionMarkerEvents } from "~app/lib/taskWorkspace.js";
import { buildTimelineConnectors, buildTimelineContextSummary, buildTimelineLayout, buildTimestampTicks, LANE_HEIGHT, NODE_WIDTH, RULER_HEIGHT, TIMELINE_LANES } from "~app/lib/timeline.js";
import type { TimelineNodeBounds } from "~app/lib/timeline.js";
import type { TimelineLane } from "~domain/monitoring.js";
import { TimelineMinimap } from "../features/timeline/TimelineMinimap.js";
import { TimelineContextChart } from "../features/timeline/TimelineContextChart.js";
import { TimelineContextBar } from "../features/timeline/TimelineContextBar.js";
import { TimelineFiltersPopover } from "../features/timeline/TimelineFiltersPopover.js";
import { TimelineEventNode } from "../features/timeline/TimelineEventNode.js";
import { TimelineLaneRow } from "../features/timeline/TimelineLaneRow.js";
import { TimelineOverlaySvg } from "../features/timeline/TimelineOverlaySvg.js";
import { TimelineStackPopover } from "../features/timeline/TimelineStackPopover.js";
import { TimelineTurnOverlay } from "../features/timeline/TimelineTurnOverlay.js";
import { TimelineSessionMarkers } from "../features/timeline/TimelineSessionMarkers.js";
import { useNodeBounds } from "../features/timeline/useNodeBounds.js";
import { useTimelineDrag } from "../features/timeline/useTimelineDrag.js";
import {
    computeTimelineFollowScrollLeft,
    shouldResetTimelineFollowForTaskChange,
} from "../features/timeline/useTimelineFollow.js";
import type { TimelineProps } from "../features/timeline/types.js";
import "./Timeline.css";

export function Timeline({
    timeline, taskTitle, taskId, taskStatus, taskUpdatedAt,
    taskUsesDerivedTitle, isEditingTaskTitle, taskTitleDraft, taskTitleError,
    isSavingTaskTitle, isUpdatingTaskStatus = false,
    selectedEventId, selectedConnectorKey, selectedRuleId, showRuleGapsOnly,
    nowMs, observabilityStats,
    onSelectEvent, onSelectConnector,
    onStartEditTitle, onCancelEditTitle, onSubmitTitle, onTitleDraftChange,
    onToggleRuleGap, onClearRuleId, onChangeTaskStatus,
    zoom, onZoomChange, embedded, externalFiltersState, externalTimelineFilters,
    turnPartition = null, focusedTurnGroupId = null, onSelectTurnGroup,
}: TimelineProps): React.JSX.Element {
    const [localFilters, setLocalFilters] = useState<Record<TimelineLane, boolean>>({
        user: true, exploration: true, planning: true, coordination: true,
        background: true, implementation: true, rule: true, questions: false, todos: false, telemetry: false,
    });
    const [expandedSubtypeLanes, setExpandedSubtypeLanes] = useState<Record<ExpandableTimelineLane, boolean>>({
        exploration: false, implementation: false, coordination: false,
    });
    const [localIsFiltersOpen, setLocalIsFiltersOpen] = useState(false);
    const [localFiltersPopoverPos, setLocalFiltersPopoverPos] = useState({ top: 0, right: 0 });
    const [openStackEventId, setOpenStackEventId] = useState<string | null>(null);
    const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const isFollowing = useRef(true);
    const [isFollowingLatest, setIsFollowingLatest] = useState(true);
    const previousTaskId = useRef<string | null | undefined>(taskId);
    const lastScrolledEventId = useRef<string | null>(null);
    const filtersPopoverRef = useRef<HTMLDivElement>(null);
    const localFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const { isDragging: isTimelineDragging, dragHandlers } = useTimelineDrag();
    const { prefs: contextWarningPrefs } = useContextWarningPrefs();

    const isFiltersOpen = externalFiltersState?.isOpen ?? localIsFiltersOpen;
    const setIsFiltersOpen = externalFiltersState?.setIsOpen ?? setLocalIsFiltersOpen;
    const filtersPopoverPos = externalFiltersState?.popoverPos ?? localFiltersPopoverPos;
    const setFiltersPopoverPos = externalFiltersState?.setPopoverPos ?? setLocalFiltersPopoverPos;
    const filtersButtonRef = externalFiltersState?.buttonRef ?? localFiltersButtonRef;
    const filters = externalTimelineFilters?.filters ?? localFilters;
    const setFilters = externalTimelineFilters?.setFilters ?? setLocalFilters;

    const anchorMs = useMemo(() => {
        if (!taskStatus || taskStatus === "running") return nowMs;
        return taskUpdatedAt ? Date.parse(taskUpdatedAt) : nowMs;
    }, [taskStatus, taskUpdatedAt, nowMs]);
    const activeBaseLanes = useMemo(() => TIMELINE_LANES.filter((l) => filters[l]), [filters]);
    const groupedTimeline = useMemo(() => groupInstructionsBursts(timeline), [timeline]);
    const hiddenEventIds = useMemo(() => {
        if (!turnPartition) return new Set<string>();
        const hidden = turnPartition.groups.filter((g) => !g.visible);
        if (hidden.length === 0) return new Set<string>();
        const ids = new Set<string>();
        for (const group of hidden) {
            for (const event of filterEventsByGroup(timeline, group)) {
                ids.add(event.id);
            }
        }
        return ids;
    }, [timeline, turnPartition]);
    const filteredTimeline = useMemo(
        () => filterTimelineEvents(groupedTimeline, { laneFilters: filters, selectedRuleId, selectedTag: null, showRuleGapsOnly })
            .filter((e) => e.lane !== "telemetry")
            .filter((e) => !isContextHydrationEvent(e))
            .filter((e) => !hiddenEventIds.has(e.id)),
        [filters, selectedRuleId, showRuleGapsOnly, groupedTimeline, hiddenEventIds],
    );
    const sessionMarkers = useMemo(() => selectSessionMarkerEvents(timeline), [timeline]);
    const expandedLaneSet = useMemo(() => {
        const active = Object.entries(expandedSubtypeLanes)
            .filter(([, enabled]) => enabled)
            .map(([lane]) => lane as ExpandableTimelineLane);
        return new Set<ExpandableTimelineLane>(active);
    }, [expandedSubtypeLanes]);
    const displayLaneRows = useMemo(
        () => buildDisplayLaneRows(filteredTimeline, activeBaseLanes, expandedLaneSet),
        [activeBaseLanes, expandedLaneSet, filteredTimeline],
    );
    const laneSubtypeCounts = useMemo(
        () => ({
            exploration: countLaneSubtypes(filteredTimeline, "exploration"),
            implementation: countLaneSubtypes(filteredTimeline, "implementation"),
            coordination: countLaneSubtypes(filteredTimeline, "coordination"),
        }),
        [filteredTimeline],
    );
    const firstExpandedSubtypeRowByLane = useMemo(() => {
        const entries = new Map<ExpandableTimelineLane, string>();
        for (const row of displayLaneRows) {
            if (!row.isSubtype) continue;
            const lane = row.baseLane;
            if (!isExpandableLane(lane) || entries.has(lane)) continue;
            entries.set(lane, row.key);
        }
        return entries;
    }, [displayLaneRows]);
    const hasExpandedSubtypeRows = useMemo(
        () => displayLaneRows.some((row) => row.isSubtype),
        [displayLaneRows],
    );
    const timelineLeftGutter = hasExpandedSubtypeRows ? 236 : 212;
    const laneLabelWidth = hasExpandedSubtypeRows ? 212 : 188;
    const timelineStageStyle = useMemo(
        () => ({
            "--timeline-left-gutter": `${timelineLeftGutter}px`,
            "--timeline-lane-label-width": `${laneLabelWidth}px`,
            "--timeline-track-left": `${Math.max(96, timelineLeftGutter - 16)}px`,
            "--timeline-gutter-scrim-width": `${timelineLeftGutter + 28}px`,
        }) as React.CSSProperties,
        [laneLabelWidth, timelineLeftGutter],
    );
    const canvasHeight = RULER_HEIGHT + displayLaneRows.length * LANE_HEIGHT;
    const timelineLayout = useMemo(
        () => buildTimelineLayout(filteredTimeline, zoom, anchorMs, displayLaneRows, { leftGutter: timelineLeftGutter }),
        [filteredTimeline, zoom, anchorMs, displayLaneRows, timelineLeftGutter],
    );
    const timestampTicks = useMemo(
        () => buildTimestampTicks(filteredTimeline, timelineLayout, anchorMs),
        [filteredTimeline, timelineLayout, anchorMs],
    );
    const snapshotItems = useMemo(
        () => groupedTimeline
            .filter((e) => e.kind === "context.snapshot")
            .map((e) => ({
                event: e,
                laneKey: "telemetry",
                baseLane: "telemetry" as const,
                left: timelineLayout.tsToLeft(Date.parse(e.createdAt)),
                top: 0,
                rowIndex: 0,
            })),
        [groupedTimeline, timelineLayout],
    );
    const compactItems = useMemo(
        () => groupedTimeline
            .filter((e) => {
                if (e.kind !== "context.saved") return false;
                const meta = e.metadata as Record<string, unknown> | undefined;
                return typeof meta?.["compactPhase"] === "string";
            })
            .map((e) => ({
                event: e,
                laneKey: "telemetry",
                baseLane: "telemetry" as const,
                left: timelineLayout.tsToLeft(Date.parse(e.createdAt)),
                top: 0,
                rowIndex: 0,
            })),
        [groupedTimeline, timelineLayout],
    );
    const { nodeBounds, nodeRefs } = useNodeBounds(timelineCanvasRef, timelineLayout.items);
    const connectors = useMemo(
        () => buildTimelineConnectors(timelineLayout.items, nodeBounds as Record<string, TimelineNodeBounds>),
        [nodeBounds, timelineLayout.items],
    );
    const timelineFocusRight = useMemo(() => {
        const measuredRightEdges = timelineLayout.items.map((item) => {
            const bounds = nodeBounds[item.event.id];
            return bounds ? bounds.left + bounds.width : item.left + NODE_WIDTH / 2;
        });
        return Math.max(timelineLayout.nowLeft, ...measuredRightEdges, 0);
    }, [nodeBounds, timelineLayout.items, timelineLayout.nowLeft]);
    const stackGroups = useMemo(() => {
        const map = new Map<string, readonly typeof timelineLayout.items[number][]>();
        for (const frontItem of timelineLayout.items) {
            if (frontItem.rowIndex !== 0) continue;
            const group = timelineLayout.items.filter(
                (other) =>
                    other.laneKey === frontItem.laneKey &&
                    Math.abs(other.left - frontItem.left) < NODE_WIDTH,
            );
            if (group.length > 1) map.set(frontItem.event.id, group);
        }
        return map;
    }, [timelineLayout.items]);
    const sessionMarkerLefts = useMemo(
        () => sessionMarkers.map((e) =>
            Math.max(timelineLayout.leftGutter, Math.min(timelineLayout.tsToLeft(Date.parse(e.createdAt)), timelineLayout.width))
        ),
        [sessionMarkers, timelineLayout],
    );
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
        : (filteredTimeline.find((e) => e.id === selectedEventId) ??
          filteredTimeline[filteredTimeline.length - 1] ??
          null);
    const turnSegments = useMemo(
        () => segmentEventsByTurn(timeline),
        [timeline],
    );
    const focusedGroupRange = useMemo(() => {
        if (!turnPartition || !focusedTurnGroupId) return null;
        const group = turnPartition.groups.find((g) => g.id === focusedTurnGroupId);
        if (!group) return null;
        const segmentByTurn = new Map<number, typeof turnSegments[number]>();
        for (const s of turnSegments) segmentByTurn.set(s.turnIndex, s);
        const first = segmentByTurn.get(group.from);
        const last = segmentByTurn.get(group.to);
        if (!first || !last) return null;
        const nextAfter = segmentByTurn.get(group.to + 1);
        const startMs = Date.parse(first.startAt);
        const endMs = Date.parse(nextAfter ? nextAfter.startAt : last.endAt);
        return {
            left: timelineLayout.tsToLeft(startMs),
            right: timelineLayout.tsToLeft(endMs),
        };
    }, [focusedTurnGroupId, timelineLayout, turnPartition, turnSegments]);
    const contextSummary = useMemo(
        () => buildTimelineContextSummary({
            filteredEventCount: filteredTimeline.length,
            totalEventCount: timeline.length,
            activeLaneCount: activeBaseLanes.length,
            totalLaneCount: TIMELINE_LANES.length,
            selectedRuleId, selectedTag: null, showRuleGapsOnly,
        }),
        [activeBaseLanes.length, filteredTimeline.length, selectedRuleId, showRuleGapsOnly, timeline.length],
    );

    // Follow scroll: keep latest event in view
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !isFollowing.current) return;
        el.scrollLeft = computeTimelineFollowScrollLeft({
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            timelineFocusRight,
        });
    }, [timelineFocusRight]);

    // Reset follow when task changes
    useEffect(() => {
        const shouldReset = shouldResetTimelineFollowForTaskChange({
            previousTaskId: previousTaskId.current,
            nextTaskId: taskId,
            selectedEventId,
            timeline: filteredTimeline,
        });
        previousTaskId.current = taskId;
        if (!shouldReset) return;
        isFollowing.current = true;
        setIsFollowingLatest(true);
        const el = scrollRef.current;
        if (!el) return;
        el.scrollLeft = computeTimelineFollowScrollLeft({
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            timelineFocusRight,
        });
    }, [filteredTimeline, selectedEventId, taskId, timelineFocusRight]);

    // Scroll to selected event
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
        setIsFollowingLatest(false);
    }, [selectedEventId, timelineLayout.items]);

    // Stack popover keyboard/outside dismiss
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

    // Close popovers on outside click / Escape
    useEffect(() => {
        if (!isFiltersOpen) return;
        const handleMouse = (e: MouseEvent): void => {
            const t = e.target as Node;
            if (filtersPopoverRef.current && !filtersPopoverRef.current.contains(t) && filtersButtonRef.current && !filtersButtonRef.current.contains(t))
                setIsFiltersOpen(false);
        };
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") { setIsFiltersOpen(false); }
        };
        window.addEventListener("mousedown", handleMouse);
        window.addEventListener("keydown", handleKey);
        return () => {
            window.removeEventListener("mousedown", handleMouse);
            window.removeEventListener("keydown", handleKey);
        };
    }, [isFiltersOpen, filtersButtonRef, filtersPopoverRef, setIsFiltersOpen]);

    return (
        <section className="flex h-full min-h-0 flex-col">
            <div className="timeline-panel">
                {!embedded && (
                    <TimelineContextBar
                        taskTitle={taskTitle}
                        taskUsesDerivedTitle={taskUsesDerivedTitle}
                        contextSummary={contextSummary}
                        showRuleGapsOnly={showRuleGapsOnly}
                        onToggleRuleGap={onToggleRuleGap}
                        selectedRuleId={selectedRuleId}
                        onClearRuleId={onClearRuleId}
                        observabilityStats={observabilityStats}
                        taskStatus={taskStatus}
                        isUpdatingTaskStatus={isUpdatingTaskStatus}
                        isEditingTaskTitle={isEditingTaskTitle}
                        taskTitleDraft={taskTitleDraft}
                        taskTitleError={taskTitleError}
                        isSavingTaskTitle={isSavingTaskTitle}
                        onTitleDraftChange={onTitleDraftChange}
                        onSubmitTitle={onSubmitTitle}
                        onCancelEditTitle={onCancelEditTitle}
                        onStartEditTitle={onStartEditTitle}
                        showInlineFiltersButton={externalFiltersState === undefined}
                        isFiltersOpen={isFiltersOpen}
                        filtersButtonRef={filtersButtonRef}
                        setFiltersPopoverPos={setFiltersPopoverPos}
                        setIsFiltersOpen={setIsFiltersOpen}
                        activeLaneCount={activeBaseLanes.length}
                        totalLaneCount={TIMELINE_LANES.length}
                        {...(onChangeTaskStatus !== undefined ? { onChangeTaskStatus } : {})}
                    />
                )}
                {isFiltersOpen && (
                    <TimelineFiltersPopover
                        filtersPopoverRef={filtersPopoverRef}
                        filtersPopoverPos={filtersPopoverPos}
                        zoom={zoom}
                        onZoomChange={onZoomChange}
                        activeLaneCount={activeBaseLanes.length}
                        totalLaneCount={TIMELINE_LANES.length}
                        filters={filters}
                        setFilters={setFilters}
                    />
                )}

                <div className="timeline-stage" style={timelineStageStyle}>
                    {filteredTimeline.length === 0 && (
                        <div className="timeline-empty-state">
                            <p>No events yet</p>
                            <span>Timeline activity will appear here as the agent runs.</span>
                        </div>
                    )}
                    <div className="timeline-edge-fade left" />
                    <div className="timeline-edge-fade right" />
                    <div className="timeline-gutter-scrim" />
                    {filteredTimeline.length > 0 && (
                        <button
                            type="button"
                            className="timeline-jump-btn"
                            aria-pressed={!isFollowingLatest}
                            onClick={() => {
                                const el = scrollRef.current;
                                if (!el) return;
                                if (isFollowingLatest) {
                                    // Already following → jump to start
                                    isFollowing.current = false;
                                    setIsFollowingLatest(false);
                                    el.scrollLeft = 0;
                                } else {
                                    // Jump to latest and re-enable follow
                                    isFollowing.current = true;
                                    setIsFollowingLatest(true);
                                    el.scrollLeft = computeTimelineFollowScrollLeft({
                                        clientWidth: el.clientWidth,
                                        scrollWidth: el.scrollWidth,
                                        timelineFocusRight,
                                    });
                                }
                            }}
                        >
                            {isFollowingLatest ? (
                                <>
                                    <span aria-hidden="true">⇤</span>
                                    <span>Jump to start</span>
                                </>
                            ) : (
                                <>
                                    <span aria-hidden="true">⇥</span>
                                    <span>Jump to latest</span>
                                </>
                            )}
                        </button>
                    )}
                    <div
                        className={`timeline-scroll${isTimelineDragging ? " is-dragging" : ""}`}
                        ref={scrollRef}
                        style={{ cursor: isTimelineDragging ? "grabbing" : "grab" }}
                        onScroll={(e) => {
                            const el = e.currentTarget;
                            const atEnd = el.scrollLeft + el.clientWidth >= timelineFocusRight + 24;
                            isFollowing.current = atEnd;
                            setIsFollowingLatest((prev) => (prev === atEnd ? prev : atEnd));
                        }}
                        {...dragHandlers}
                    >
                        <div
                            className="timeline-canvas"
                            ref={timelineCanvasRef}
                            style={{ width: `${timelineLayout.width}px`, minHeight: `${canvasHeight}px` }}
                        >
                            <TimelineOverlaySvg
                                width={timelineLayout.width}
                                height={canvasHeight}
                                timestampTicks={timestampTicks}
                                connectors={connectors}
                                selectedConnectorKey={selectedConnectorKey}
                                onSelectConnector={onSelectConnector}
                            />

                            <TimelineTurnOverlay
                                segments={turnSegments}
                                layout={timelineLayout}
                                canvasHeight={canvasHeight}
                                canvasWidth={timelineLayout.width}
                                sessionMarkerLefts={sessionMarkerLefts}
                                partition={turnPartition}
                                focusedGroupId={focusedTurnGroupId}
                                onSelectGroup={onSelectTurnGroup}
                            />

                            <TimelineSessionMarkers
                                events={sessionMarkers}
                                layout={timelineLayout}
                                canvasHeight={canvasHeight}
                                canvasWidth={timelineLayout.width}
                            />

                            {displayLaneRows.map((row, index) => (
                                <TimelineLaneRow
                                    key={row.key}
                                    row={row}
                                    index={index}
                                    expandedSubtypeLanes={expandedSubtypeLanes}
                                    laneSubtypeCounts={laneSubtypeCounts}
                                    firstExpandedSubtypeRowByLane={firstExpandedSubtypeRowByLane}
                                    onToggleLane={(lane, expanded) =>
                                        setExpandedSubtypeLanes((current) => ({ ...current, [lane]: expanded }))
                                    }
                                />
                            ))}

                            <div className="now-line" style={{ left: `${timelineLayout.nowLeft}px`, top: `${RULER_HEIGHT}px` }}>
                                <span className="now-label">now</span>
                            </div>

                            {[...timelineLayout.items]
                                .sort((a, b) => b.rowIndex - a.rowIndex)
                                .map((item) => (
                                    <TimelineEventNode
                                        key={item.event.id}
                                        item={item}
                                        selectedEvent={selectedEvent}
                                        selectedConnector={selectedConnector}
                                        taskTitle={taskTitle}
                                        openStackEventId={openStackEventId}
                                        stackGroups={stackGroups}
                                        onSelectEvent={onSelectEvent}
                                        onOpenStack={setOpenStackEventId}
                                        onRegisterNode={(id, node) => {
                                            if (node) nodeRefs.current.set(id, node);
                                            else nodeRefs.current.delete(id);
                                        }}
                                    />
                                ))}

                            {openStackEventId && (
                                <TimelineStackPopover
                                    openStackEventId={openStackEventId}
                                    items={timelineLayout.items}
                                    stackGroups={stackGroups}
                                    nodeBounds={nodeBounds}
                                    selectedEvent={selectedEvent}
                                    taskTitle={taskTitle}
                                    onSelectEvent={onSelectEvent}
                                    onClose={() => setOpenStackEventId(null)}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {filteredTimeline.length > 0 && (
                    <>
                        <div className="timeline-visual-legend" role="note" aria-label="Timeline visual guide">
                            <div className="timeline-visual-legend-item">
                                <span className="timeline-visual-swatch viewport" aria-hidden="true" />
                                <span>Bottom minimap box = currently visible timeline range</span>
                            </div>
                        </div>
                        <TimelineMinimap
                            timelineWidth={timelineLayout.width}
                            canvasHeight={canvasHeight}
                            items={timelineLayout.items}
                            laneRows={displayLaneRows}
                            scrollRef={scrollRef}
                            focusedRange={focusedGroupRange}
                        />
                        <TimelineContextChart
                            timelineWidth={timelineLayout.width}
                            allItems={timelineLayout.items}
                            snapshotItems={snapshotItems}
                            compactItems={compactItems}
                            contextWarningPrefs={contextWarningPrefs}
                        />
                    </>
                )}
            </div>
        </section>
    );
}
