import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildExplorationInsight, buildSubagentInsight, collectFileActivity, collectWebLookups } from "~app/lib/insights/aggregation.js";
import { buildQuestionGroups, buildTodoGroups, buildVerificationCycles } from "~app/lib/insights/grouping.js";
import type { ModelSummary } from "~app/lib/insights/grouping.js";
import { buildTaskTimelineSummary } from "~app/lib/taskTimelineSummary.js";
import type { TimelineConnector } from "~app/lib/timeline.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import type { TaskDetailResponse } from "~domain/task-query-contracts.js";
import { cn } from "../lib/ui/cn.js";
import { buildFileEvidenceRows, sortFileEvidenceRows, type FileEvidenceSortKey } from "./inspector/FileEvidenceSection.js";
import { EvidenceTab } from "./inspector/EvidenceTab.js";
import { InspectorTab } from "./inspector/InspectorTab.js";
import { OverviewTab } from "./inspector/OverviewTab.js";
import { RuleTab } from "./inspector/RuleTab.js";
import { TurnsTab } from "./inspector/TurnsTab.js";
import { useOptionalInspectorContext } from "../features/inspector/context/InspectorContext.js";

export type PanelTabId = "inspector" | "overview" | "evidence" | "rules" | "turns";
const PANEL_TABS = [
    { id: "inspector", label: "Event" },
    { id: "overview", label: "Task" },
    { id: "turns", label: "Turns" },
    { id: "evidence", label: "Exploration" },
    { id: "rules", label: "Rules" },
] as const;

interface SelectedConnectorData {
    readonly connector: TimelineConnector;
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}

/**
 * Domain props are optional when an <InspectorProvider> ancestor supplies them via context.
 * Explicit props always take priority over context. UI config props remain explicit.
 */
interface EventInspectorProps {
    // Domain data — optional when provided via InspectorProvider
    readonly taskDetail?: TaskDetailResponse | null;
    readonly selectedTaskTitle?: string | null;
    readonly selectedEvent?: TimelineEventRecord | null;
    readonly selectedConnector?: SelectedConnectorData | null;
    readonly selectedEventDisplayTitle?: string | null;
    readonly selectedRuleId?: string | null;
    readonly taskModelSummary?: ModelSummary | undefined;
    // Handlers — optional when provided via InspectorProvider
    readonly onUpdateEventDisplayTitle?: ((eventId: string, displayTitle: string | null) => Promise<void>) | undefined;
    readonly onSelectRule?: ((ruleId: string | null) => void) | undefined;
    // UI config — always explicit on the component
    readonly isCollapsed?: boolean;
    readonly className?: string | undefined;
    readonly allowedTabs?: readonly PanelTabId[];
    readonly initialTab?: PanelTabId;
    readonly activeTab?: PanelTabId;
    readonly panelLabel?: string;
    readonly showCollapseControl?: boolean;
    readonly singleTabHeaderLayout?: "stacked" | "inline";
    readonly onToggleCollapse?: () => void;
    readonly onActiveTabChange?: (tab: PanelTabId) => void;
    /** Extra header content rendered next to the Workspace button (e.g. ViewModeToggle). */
    readonly headerExtra?: React.ReactNode;
    /** When provided, replaces the standard tab content area. */
    readonly children?: React.ReactNode;
}

export function EventInspector({
    taskDetail: taskDetailProp,
    selectedTaskTitle: selectedTaskTitleProp,
    selectedEvent: selectedEventProp,
    selectedConnector: selectedConnectorProp,
    selectedEventDisplayTitle: selectedEventDisplayTitleProp,
    selectedRuleId: selectedRuleIdProp,
    taskModelSummary: taskModelSummaryProp,
    onUpdateEventDisplayTitle: onUpdateEventDisplayTitleProp,
    onSelectRule: onSelectRuleProp,
    isCollapsed = false,
    className,
    allowedTabs = PANEL_TABS.map((tab) => tab.id),
    initialTab,
    activeTab: controlledActiveTab,
    panelLabel,
    showCollapseControl = true,
    singleTabHeaderLayout = "stacked",
    onToggleCollapse,
    onActiveTabChange,
    headerExtra,
    children,
}: EventInspectorProps): React.JSX.Element {
    // Context fallback — props take priority, context fills gaps
    const ctx = useOptionalInspectorContext();
    const taskDetail = taskDetailProp !== undefined ? taskDetailProp : (ctx?.taskDetail ?? null);
    const selectedTaskTitle = selectedTaskTitleProp !== undefined ? selectedTaskTitleProp : (ctx?.selectedTaskTitle ?? null);
    const selectedEvent = selectedEventProp !== undefined ? selectedEventProp : (ctx?.selectedEvent ?? null);
    const selectedConnector = selectedConnectorProp !== undefined ? selectedConnectorProp : (ctx?.selectedConnector ?? null);
    const selectedRuleId = selectedRuleIdProp !== undefined ? selectedRuleIdProp : (ctx?.selectedRuleId ?? null);
    const taskModelSummary = taskModelSummaryProp ?? ctx?.taskModelSummary;
    const onUpdateEventDisplayTitle = onUpdateEventDisplayTitleProp ?? ctx?.onUpdateEventDisplayTitle ?? (() => Promise.resolve());
    const onSelectRule = onSelectRuleProp ?? ctx?.onSelectRule ?? (() => undefined);
    const onSelectEvent = ctx?.onSelectEvent;

    // selectedEventDisplayTitle: check prop, then context, then infer from event metadata
    const selectedEventDisplayTitleFromCtxOrProp = selectedEventDisplayTitleProp !== undefined
        ? selectedEventDisplayTitleProp
        : (ctx?.selectedEventDisplayTitle ?? null);

    const resolvedAllowedTabs = useMemo<readonly PanelTabId[]>(() => allowedTabs.length > 0 ? allowedTabs : ["inspector"], [allowedTabs]);
    const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<PanelTabId>(() => {
        const nextTab = initialTab ?? resolvedAllowedTabs[0] ?? "inspector";
        return resolvedAllowedTabs.includes(nextTab) ? nextTab : resolvedAllowedTabs[0] ?? "inspector";
    });
    const activeTab = controlledActiveTab && resolvedAllowedTabs.includes(controlledActiveTab)
        ? controlledActiveTab
        : uncontrolledActiveTab;
    const [isFileEvidenceExpanded, setIsFileEvidenceExpanded] = useState(true);
    const [fileEvidenceSortKey, setFileEvidenceSortKey] = useState<FileEvidenceSortKey>("recent");

    const taskTimeline = taskDetail?.timeline ?? [];
    const { exploredFiles } = useMemo(() => buildTaskTimelineSummary(taskTimeline), [taskTimeline]);
    const fileActivity = useMemo(() => collectFileActivity(taskTimeline), [taskTimeline]);
    const fileEvidence = useMemo(() => buildFileEvidenceRows(fileActivity, exploredFiles), [exploredFiles, fileActivity]);
    const sortedFileEvidence = useMemo(() => sortFileEvidenceRows(fileEvidence, fileEvidenceSortKey), [fileEvidence, fileEvidenceSortKey]);
    const webLookups = useMemo(() => collectWebLookups(taskTimeline), [taskTimeline]);
    const explorationInsight = useMemo(() => buildExplorationInsight(taskTimeline, exploredFiles, webLookups), [exploredFiles, taskTimeline, webLookups]);
    const questionGroups = useMemo(() => buildQuestionGroups(taskTimeline), [taskTimeline]);
    const todoGroups = useMemo(() => buildTodoGroups(taskTimeline), [taskTimeline]);
    const subagentInsight = useMemo(() => buildSubagentInsight(taskTimeline), [taskTimeline]);
    const verificationCycles = useMemo(() => buildVerificationCycles(taskTimeline), [taskTimeline]);
    const mentionedVerifications: never[] = [];

    const relatedEvents = useMemo(() => {
        if (!selectedEvent) return [];
        const relatedIds = new Set<string>();
        const parentEventId = selectedEvent.metadata["parentEventId"];
        if (typeof parentEventId === "string") relatedIds.add(parentEventId);
        const relationIds = selectedEvent.metadata["relatedEventIds"];
        if (Array.isArray(relationIds)) {
            for (const value of relationIds) {
                if (typeof value === "string") relatedIds.add(value);
            }
        }
        return taskTimeline.filter((event) => relatedIds.has(event.id));
    }, [selectedEvent, taskTimeline]);

    const eventTime = selectedEvent ? new Date(selectedEvent.createdAt).toLocaleTimeString() : null;
    const selectedEventDisplayTitleOverride = selectedEvent && typeof selectedEvent.metadata["displayTitle"] === "string"
        ? selectedEvent.metadata["displayTitle"].trim()
        : null;
    const selectedEventDisplayTitle = selectedEventDisplayTitleFromCtxOrProp ?? selectedEventDisplayTitleOverride;
    const canEditSelectedEventTitle = Boolean(selectedEvent && selectedEvent.kind !== "task.start");

    useEffect(() => {
        if (!resolvedAllowedTabs.includes(uncontrolledActiveTab)) {
            setUncontrolledActiveTab(resolvedAllowedTabs[0] ?? "inspector");
        }
    }, [resolvedAllowedTabs, uncontrolledActiveTab]);
    useEffect(() => {
        if (!initialTab || !resolvedAllowedTabs.includes(initialTab)) return;
        setUncontrolledActiveTab((current) => (current === initialTab ? current : initialTab));
    }, [initialTab, resolvedAllowedTabs]);
    const onActiveTabChangeRef = useRef(onActiveTabChange);
    onActiveTabChangeRef.current = onActiveTabChange;
    useEffect(() => {
        onActiveTabChangeRef.current?.(activeTab);
    }, [activeTab]);

    const visibleTabs = useMemo(() => PANEL_TABS.filter((tab) => resolvedAllowedTabs.includes(tab.id)), [resolvedAllowedTabs]);
    const isSingleTabMode = visibleTabs.length <= 1;
    const isInlineSingleTabHeader = isSingleTabMode && singleTabHeaderLayout === "inline";
    const resolvedPanelLabel = panelLabel ?? visibleTabs[0]?.label ?? "Inspector";
    const collapseControl = showCollapseControl ? (
        <button aria-label={isCollapsed ? "Expand inspector" : "Collapse inspector"} className="inspector-toggle-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={onToggleCollapse} title={isCollapsed ? "Expand inspector" : "Collapse inspector"} type="button">
            <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                {isCollapsed ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
            </svg>
        </button>
    ) : null;

    return (
        <aside className={cn("detail-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]", className)}>
            <div className={cn("panel-tab-bar border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2", isSingleTabMode ? "flex flex-col gap-2" : "grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center")} {...(isSingleTabMode ? {} : { "aria-label": "Inspector panels" })} role={isSingleTabMode ? undefined : "tablist"}>
                {isSingleTabMode ? (isInlineSingleTabHeader ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            {collapseControl}
                            <div className="min-w-0 truncate px-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{resolvedPanelLabel}</div>
                        </div>
                        {headerExtra}
                    </div>
                ) : (
                    <>
                        <div className="flex min-w-0 items-center gap-2">
                            {collapseControl}
                            <div className="min-w-0 truncate px-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">{resolvedPanelLabel}</div>
                        </div>
                        {headerExtra}
                    </>
                )) : (
                    <>
                        {collapseControl}
                        {visibleTabs.map((tab) => (
                            <button key={tab.id} aria-selected={activeTab === tab.id} className={cn("panel-tab inline-flex h-8 items-center rounded-[var(--radius-md)] border px-3 text-[0.76rem] font-semibold transition-colors w-full justify-center px-2.5 sm:w-auto sm:px-3", activeTab === tab.id ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]" : "border-transparent bg-transparent text-[var(--text-3)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]")} onClick={() => { if (controlledActiveTab === undefined) setUncontrolledActiveTab(tab.id); onActiveTabChange?.(tab.id); }} role="tab" type="button">
                                {tab.label}
                            </button>
                        ))}
                        {headerExtra}
                    </>
                )}
            </div>
            <div className="panel-tab-content flex min-h-0 flex-1 flex-col overflow-y-auto" role="tabpanel">
                {children ?? (activeTab === "inspector" ? (
                    <InspectorTab
                        selectedEvent={selectedEvent} selectedConnector={selectedConnector}
                        selectedEventDisplayTitle={selectedEventDisplayTitle}
                        selectedEventDisplayTitleOverride={selectedEventDisplayTitleOverride}
                        canEditSelectedEventTitle={canEditSelectedEventTitle}
                        eventTime={eventTime} questionGroups={questionGroups} todoGroups={todoGroups}
                        relatedEvents={relatedEvents} selectedRuleId={selectedRuleId}
                        onUpdateEventDisplayTitle={onUpdateEventDisplayTitle}
                        onSelectRule={onSelectRule}
                        taskDetail={taskDetail}
                    />
                ) : activeTab === "overview" ? (
                    <OverviewTab
                        subagentInsight={subagentInsight}
                        verificationCycles={verificationCycles} runtimeSessionId={taskDetail?.runtimeSessionId}
                        runtimeSource={taskDetail?.runtimeSource} workspacePath={taskDetail?.task.workspacePath}
                        timeline={taskTimeline} todoGroups={todoGroups} questionGroups={questionGroups}
                        {...(taskModelSummary ? { taskModelSummary } : {})}
                        partition={ctx?.turnPartition ?? null}
                        focusedGroupId={ctx?.focusedTurnGroupId ?? null}
                        onFocusGroup={ctx?.onFocusTurnGroup}
                    />
                ) : activeTab === "turns" ? (
                    <TurnsTab
                        taskId={taskDetail?.task.id}
                        taskTitle={selectedTaskTitle ?? taskDetail?.task.title ?? ""}
                        taskTimeline={taskTimeline}
                        turnSummaries={taskDetail?.turns ?? []}
                        partition={ctx?.turnPartition ?? null}
                        focusedGroupId={ctx?.focusedTurnGroupId ?? null}
                        isSaving={ctx?.turnPartitionSaving ?? false}
                        onFocusGroup={ctx?.onFocusTurnGroup ?? (() => undefined)}
                        onMergeNext={ctx?.onMergeTurnGroup ?? (() => Promise.resolve())}
                        onSplit={ctx?.onSplitTurnGroup ?? (() => Promise.resolve())}
                        onToggleVisibility={ctx?.onToggleTurnGroupVisibility ?? (() => Promise.resolve())}
                        onRename={ctx?.onRenameTurnGroup ?? (() => Promise.resolve())}
                        onReset={ctx?.onResetTurnPartition ?? (() => Promise.resolve())}
                    />
                ) : activeTab === "evidence" ? (
                    <EvidenceTab
                        sortedFileEvidence={sortedFileEvidence} workspacePath={taskDetail?.task.workspacePath}
                        isFileEvidenceExpanded={isFileEvidenceExpanded} fileEvidenceSortKey={fileEvidenceSortKey}
                        explorationInsight={explorationInsight} webLookups={webLookups}
                        mentionedVerifications={mentionedVerifications}
                        onToggleFileEvidence={() => setIsFileEvidenceExpanded((v) => !v)}
                        onFileEvidenceSortChange={setFileEvidenceSortKey}
                        timeline={taskTimeline}
                        partition={ctx?.turnPartition ?? null}
                        focusedGroupId={ctx?.focusedTurnGroupId ?? null}
                        onFocusGroup={ctx?.onFocusTurnGroup}
                    />
                ) : (
                    <RuleTab
                        timeline={taskTimeline}
                        taskId={taskDetail?.task.id}
                        onSelectEvent={onSelectEvent}
                    />
                ))}
            </div>
        </aside>
    );
}
