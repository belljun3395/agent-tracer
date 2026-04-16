import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildReusableTaskSnapshot } from "@monitor/core";
import { buildExplorationInsight, buildInspectorEventTitle, buildMentionedFileVerifications, buildQuestionGroups, buildSubagentInsight, buildTagInsights, buildTaskExtraction, buildTodoGroups, buildVerificationCycles, collectFileActivity, collectPlanSteps, collectViolationDescriptions, collectWebLookups, buildTaskTimelineSummary, type BookmarkRecord, type ModelSummary, type TaskObservabilityResponse, type TaskDetailResponse, type TimelineConnector, type TimelineEvent } from "@monitor/web-domain";
import { useEvaluation } from "@monitor/web-state";
import { cn } from "../lib/ui/cn.js";
import { Button } from "./ui/Button.js";
import { sortExploredFiles, type ExplorationSortKey } from "./inspector/ExploredFilesSection.js";
import { sortFileActivity, type FileSortKey } from "./inspector/FileActivitySection.js";
import { ActionsTab } from "./inspector/ActionsTab.js";
import { EvidenceTab } from "./inspector/EvidenceTab.js";
import { InspectorTab } from "./inspector/InspectorTab.js";
import { OverviewTab } from "./inspector/OverviewTab.js";
export type PanelTabId = "inspector" | "overview" | "evidence" | "actions";
const PANEL_TABS = [
    { id: "inspector", label: "Inspector" },
    { id: "overview", label: "Overview" },
    { id: "evidence", label: "Evidence" },
    { id: "actions", label: "Actions" },
] as const;
export const TASK_WORKSPACE_TAB_IDS: readonly PanelTabId[] = [
    "overview",
    "evidence",
    "actions"
];
interface SelectedConnectorData {
    readonly connector: TimelineConnector;
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
}
interface EventInspectorProps {
    readonly taskDetail: TaskDetailResponse | null;
    readonly selectedTaskTitle?: string | null;
    readonly taskObservability?: TaskObservabilityResponse | null;
    readonly selectedEvent: TimelineEvent | null;
    readonly selectedConnector: SelectedConnectorData | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly selectedTaskBookmark?: BookmarkRecord | null;
    readonly selectedEventBookmark?: BookmarkRecord | null;
    readonly selectedTag: string | null;
    readonly selectedRuleId: string | null;
    readonly taskModelSummary?: ModelSummary | undefined;
    readonly isCollapsed?: boolean;
    readonly className?: string | undefined;
    readonly allowedTabs?: readonly PanelTabId[];
    readonly initialTab?: PanelTabId;
    readonly activeTab?: PanelTabId;
    readonly panelLabel?: string;
    readonly showCollapseControl?: boolean;
    readonly showInspectorSummaryFooter?: boolean;
    readonly singleTabHeaderLayout?: "stacked" | "inline";
    readonly onToggleCollapse?: () => void;
    readonly onActiveTabChange?: (tab: PanelTabId) => void;
    readonly onOpenTaskWorkspace?: () => void;
    readonly onCreateTaskBookmark: () => void;
    readonly onCreateEventBookmark: () => void;
    readonly onUpdateEventDisplayTitle: (eventId: string, displayTitle: string | null) => Promise<void>;
    readonly onSelectTag: (tag: string | null) => void;
    readonly onSelectRule: (ruleId: string | null) => void;
}
export function EventInspector({ taskDetail, selectedTaskTitle = null, taskObservability = null, selectedEvent, selectedConnector, selectedEventDisplayTitle, selectedTaskBookmark = null, selectedEventBookmark = null, selectedTag, selectedRuleId, taskModelSummary, isCollapsed = false, className, allowedTabs = PANEL_TABS.map((tab) => tab.id), initialTab, activeTab: controlledActiveTab, panelLabel, showCollapseControl = true, showInspectorSummaryFooter = true, singleTabHeaderLayout = "stacked", onToggleCollapse, onActiveTabChange, onOpenTaskWorkspace, onCreateTaskBookmark, onCreateEventBookmark, onUpdateEventDisplayTitle, onSelectTag, onSelectRule }: EventInspectorProps): React.JSX.Element {
    const resolvedAllowedTabs = useMemo<readonly PanelTabId[]>(() => allowedTabs.length > 0 ? allowedTabs : ["inspector"], [allowedTabs]);
    const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<PanelTabId>(() => {
        const nextTab = initialTab ?? resolvedAllowedTabs[0] ?? "inspector";
        return resolvedAllowedTabs.includes(nextTab) ? nextTab : resolvedAllowedTabs[0] ?? "inspector";
    });
    const activeTab = controlledActiveTab && resolvedAllowedTabs.includes(controlledActiveTab)
        ? controlledActiveTab
        : uncontrolledActiveTab;
    const [isExploredFilesExpanded, setIsExploredFilesExpanded] = useState(true);
    const [isFileActivityExpanded, setIsFileActivityExpanded] = useState(true);
    const [explorationSortKey, setExplorationSortKey] = useState<ExplorationSortKey>("recent");
    const [fileSortKey, setFileSortKey] = useState<FileSortKey>("recent");
    const { evaluation: taskEvaluation, isSaving: isSavingTaskEvaluation, isSaved: isSavedTaskEvaluation, saveEvaluation: saveTaskEvaluation } = useEvaluation(taskDetail?.task.id ?? null);
    const taskTimeline = taskDetail?.timeline ?? [];
    const observability = taskObservability?.observability ?? null;
    const { exploredFiles, observabilityStats } = useMemo(() => buildTaskTimelineSummary(taskTimeline), [taskTimeline]);
    const fileActivity = useMemo(() => collectFileActivity(taskTimeline), [taskTimeline]);
    const sortedExploredFiles = useMemo(() => sortExploredFiles(exploredFiles, explorationSortKey), [exploredFiles, explorationSortKey]);
    const sortedFileActivity = useMemo(() => sortFileActivity(fileActivity, fileSortKey), [fileActivity, fileSortKey]);
    const webLookups = useMemo(() => collectWebLookups(taskTimeline), [taskTimeline]);
    const explorationInsight = useMemo(() => buildExplorationInsight(taskTimeline, exploredFiles, webLookups), [exploredFiles, taskTimeline, webLookups]);
    const taskExtraction = useMemo(() => buildTaskExtraction(taskDetail?.task, taskTimeline, exploredFiles), [exploredFiles, taskDetail?.task, taskTimeline]);
    const tagInsights = useMemo(() => buildTagInsights(taskTimeline), [taskTimeline]);
    const questionGroups = useMemo(() => buildQuestionGroups(taskTimeline), [taskTimeline]);
    const todoGroups = useMemo(() => buildTodoGroups(taskTimeline), [taskTimeline]);
    const subagentInsight = useMemo(() => buildSubagentInsight(taskTimeline), [taskTimeline]);
    const verificationCycles = useMemo(() => buildVerificationCycles(taskTimeline), [taskTimeline]);
    const mentionedVerifications = useMemo(() => buildMentionedFileVerifications(taskTimeline, exploredFiles, taskDetail?.task.workspacePath), [exploredFiles, taskDetail?.task.workspacePath, taskTimeline]);
    const handoffExploredFiles = useMemo(() => exploredFiles.map((file) => file.path), [exploredFiles]);
    const handoffModifiedFiles = useMemo(() => collectFileActivity(taskTimeline).filter(f => f.writeCount > 0).map(f => f.path), [taskTimeline]);
    const handoffOpenTodos = useMemo(() => todoGroups.filter(g => !g.isTerminal).map(g => g.title), [todoGroups]);
    const handoffOpenQuestions = useMemo(() => questionGroups
        .filter(g => !g.isComplete)
        .flatMap(g => g.phases)
        .filter(p => p.phase === "asked")
        .map(p => p.event.body ?? p.event.title)
        .filter(Boolean), [questionGroups]);
    const handoffViolations = useMemo(() => collectViolationDescriptions(taskTimeline), [taskTimeline]);
    const handoffPlans = useMemo(() => collectPlanSteps(taskTimeline), [taskTimeline]);
    const handoffSnapshot = useMemo(() => buildReusableTaskSnapshot({
        objective: taskExtraction.objective,
        events: taskTimeline,
        evaluation: taskEvaluation ?? null
    }), [taskExtraction.objective, taskTimeline, taskEvaluation]);
    const relatedEvents = useMemo(() => {
        if (!selectedEvent) {
            return [];
        }
        const relatedIds = new Set<string>();
        const parentEventId = selectedEvent.metadata["parentEventId"];
        if (typeof parentEventId === "string") {
            relatedIds.add(parentEventId);
        }
        const relationIds = selectedEvent.metadata["relatedEventIds"];
        if (Array.isArray(relationIds)) {
            for (const value of relationIds) {
                if (typeof value === "string") {
                    relatedIds.add(value);
                }
            }
        }
        return taskTimeline.filter((event) => relatedIds.has(event.id));
    }, [selectedEvent, taskTimeline]);
    const eventTime = selectedEvent
        ? new Date(selectedEvent.createdAt).toLocaleTimeString()
        : null;
    const selectedEventDisplayTitleOverride = selectedEvent && typeof selectedEvent.metadata["displayTitle"] === "string"
        ? selectedEvent.metadata["displayTitle"].trim()
        : null;
    const canEditSelectedEventTitle = Boolean(selectedEvent && selectedEvent.kind !== "task.start");
    const obsBadges = taskDetail ? [
        { key: "actions", label: "Actions", value: observabilityStats.actions, tone: "accent" as const },
        { key: "coordination", label: "Coordination", value: observabilityStats.coordinationActivities, tone: "success" as const },
        { key: "files", label: "Files", value: observabilityStats.exploredFiles, tone: "neutral" as const },
        { key: "compacts", label: "Compact", value: observabilityStats.compactions, tone: "warning" as const },
        { key: "checks", label: "Check", value: observabilityStats.checks, tone: "accent" as const },
        { key: "violations", label: "Violation", value: observabilityStats.violations, tone: "danger" as const },
        { key: "passes", label: "Pass", value: observabilityStats.passes, tone: "success" as const },
    ].filter((b) => b.value > 0) : [];
    useEffect(() => {
        if (!resolvedAllowedTabs.includes(uncontrolledActiveTab)) {
            setUncontrolledActiveTab(resolvedAllowedTabs[0] ?? "inspector");
        }
    }, [resolvedAllowedTabs, uncontrolledActiveTab]);
    useEffect(() => {
        if (!initialTab || !resolvedAllowedTabs.includes(initialTab)) {
            return;
        }
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
    const openWorkspaceLabel = isSingleTabMode ? "Workspace" : "Open Workspace";
    const hasWorkspaceAction = onOpenTaskWorkspace !== undefined;
    const collapseControl = showCollapseControl ? (<button aria-label={isCollapsed ? "Expand inspector" : "Collapse inspector"} className="inspector-toggle-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1" onClick={onToggleCollapse} title={isCollapsed ? "Expand inspector" : "Collapse inspector"} type="button">
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
        {isCollapsed ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
      </svg>
    </button>) : null;
    const openWorkspaceButton = onOpenTaskWorkspace ? (<Button className={cn("h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none whitespace-nowrap", isSingleTabMode
            ? (isInlineSingleTabHeader ? "h-7 shrink-0 px-2.5 text-[0.72rem]" : "w-full justify-center")
            : "ml-auto shrink-0")} onClick={onOpenTaskWorkspace} size="sm" type="button">
      {openWorkspaceLabel}
    </Button>) : null;
    return (<aside className={cn("detail-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]", className)}>

      <div className={cn("panel-tab-bar border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2", isSingleTabMode
            ? "flex flex-col gap-2"
            : hasWorkspaceAction
                ? "flex items-center gap-1 overflow-x-auto"
                : "grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center")} {...(isSingleTabMode ? {} : { "aria-label": "Inspector panels" })} role={isSingleTabMode ? undefined : "tablist"}>
        {isSingleTabMode ? (isInlineSingleTabHeader ? (<div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {collapseControl}
                <div className="min-w-0 truncate px-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">
                  {resolvedPanelLabel}
                </div>
              </div>
              {openWorkspaceButton}
            </div>) : (<>
              <div className="flex min-w-0 items-center gap-2">
                {collapseControl}
                <div className="min-w-0 truncate px-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">
                  {resolvedPanelLabel}
                </div>
              </div>
              {openWorkspaceButton}
            </>)) : (<>
            {collapseControl}
            {visibleTabs.map((tab) => (<button key={tab.id} aria-selected={activeTab === tab.id} className={cn("panel-tab inline-flex h-8 items-center rounded-[var(--radius-md)] border px-3 text-[0.76rem] font-semibold transition-colors", !hasWorkspaceAction && "w-full justify-center px-2.5 sm:w-auto sm:px-3", activeTab === tab.id
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-transparent bg-transparent text-[var(--text-3)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]")} onClick={() => {
                    if (controlledActiveTab === undefined) {
                        setUncontrolledActiveTab(tab.id);
                    }
                    onActiveTabChange?.(tab.id);
                }} role="tab" type="button">
                {tab.label}
                {tab.id === "actions" && taskEvaluation && (<span className={cn("ml-1.5 h-1.5 w-1.5 rounded-full", taskEvaluation.rating === "good" ? "bg-[var(--ok)]" : "bg-[var(--text-3)]")}/>)}
              </button>))}
            {openWorkspaceButton}
          </>)}
      </div>


      <div className={cn("panel-tab-content flex min-h-0 flex-1 flex-col overflow-y-auto")} role="tabpanel">

        {activeTab === "inspector" ? (<InspectorTab selectedEvent={selectedEvent} selectedConnector={selectedConnector} selectedEventDisplayTitle={selectedEventDisplayTitle} selectedEventDisplayTitleOverride={selectedEventDisplayTitleOverride} canEditSelectedEventTitle={canEditSelectedEventTitle} selectedTaskBookmark={selectedTaskBookmark} selectedEventBookmark={selectedEventBookmark} eventTime={eventTime} questionGroups={questionGroups} todoGroups={todoGroups} relatedEvents={relatedEvents} selectedTag={selectedTag} selectedRuleId={selectedRuleId} onCreateTaskBookmark={onCreateTaskBookmark} onCreateEventBookmark={onCreateEventBookmark} onUpdateEventDisplayTitle={onUpdateEventDisplayTitle} onSelectTag={onSelectTag} onSelectRule={onSelectRule} {...(onOpenTaskWorkspace !== undefined ? { onOpenTaskWorkspace } : {})} openWorkspaceLabel={openWorkspaceLabel} obsBadges={obsBadges} showInspectorSummaryFooter={showInspectorSummaryFooter} taskModelSummary={taskModelSummary} taskDetail={taskDetail}/>) : activeTab === "overview" ? (<OverviewTab observability={observability} subagentInsight={subagentInsight} verificationCycles={verificationCycles} runtimeSessionId={taskDetail?.runtimeSessionId} runtimeSource={taskDetail?.runtimeSource} workspacePath={taskDetail?.task.workspacePath}/>) : activeTab === "evidence" ? (<EvidenceTab tagInsights={tagInsights} selectedTag={selectedTag} sortedFileActivity={sortedFileActivity} workspacePath={taskDetail?.task.workspacePath} isFileActivityExpanded={isFileActivityExpanded} fileSortKey={fileSortKey} explorationInsight={explorationInsight} webLookups={webLookups} sortedExploredFiles={sortedExploredFiles} isExploredFilesExpanded={isExploredFilesExpanded} explorationSortKey={explorationSortKey} mentionedVerifications={mentionedVerifications} onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)} onToggleFileActivity={() => setIsFileActivityExpanded((current) => !current)} onFileSortChange={setFileSortKey} onToggleExploredFiles={() => setIsExploredFilesExpanded((current) => !current)} onExplorationSortChange={setExplorationSortKey}/>) : (<ActionsTab taskId={taskDetail?.task.id} taskTitle={selectedTaskTitle ?? taskDetail?.task.title ?? ""} workspacePath={taskDetail?.task.workspacePath} taskExtraction={taskExtraction} taskTimeline={taskTimeline} handoffPlans={handoffPlans} handoffExploredFiles={handoffExploredFiles} handoffModifiedFiles={handoffModifiedFiles} handoffOpenTodos={handoffOpenTodos} handoffOpenQuestions={handoffOpenQuestions} handoffViolations={handoffViolations} handoffSnapshot={handoffSnapshot} evaluation={taskEvaluation} isSavingEvaluation={isSavingTaskEvaluation} isSavedEvaluation={isSavedTaskEvaluation} onSaveEvaluation={saveTaskEvaluation}/>)}
      </div>
    </aside>);
}
