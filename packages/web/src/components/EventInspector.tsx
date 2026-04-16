import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildReusableTaskSnapshot, getEventEvidence } from "@monitor/core";
import { buildExplorationInsight, buildInspectorEventTitle, buildMentionedFileVerifications, buildQuestionGroups, buildSubagentInsight, buildTagInsights, buildTaskExtraction, buildTodoGroups, buildVerificationCycles, collectFileActivity, collectPlanSteps, collectViolationDescriptions, collectWebLookups, evidenceTone, formatEvidenceLevel, buildTaskTimelineSummary, type BookmarkRecord, type ModelSummary, type TaskObservabilityResponse, type TaskDetailResponse, type TimelineConnector, type TimelineEvent } from "@monitor/web-domain";
import { useEvaluation } from "@monitor/web-state";
import { cn } from "../lib/ui/cn.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { QuestionGroupSection } from "./inspector/QuestionGroupSection.js";
import { TodoGroupSection } from "./inspector/TodoGroupSection.js";
import { sortExploredFiles, type ExplorationSortKey } from "./inspector/ExploredFilesSection.js";
import { sortFileActivity, type FileSortKey } from "./inspector/FileActivitySection.js";
import { ActionsTab } from "./inspector/ActionsTab.js";
import { EvidenceTab } from "./inspector/EvidenceTab.js";
import { OverviewTab } from "./inspector/OverviewTab.js";
import {
    DetailCaptureInfo,
    DetailConnectorEvents,
    DetailConnectorIds,
    DetailEventEvidence,
    DetailIds,
    DetailMatchList,
    DetailModelInfo,
    DetailRelatedEvents,
    DetailSection,
    DetailTags,
    DetailTaskModel,
    DetailTokenUsage,
    InspectorHeaderCard
} from "./inspector/InspectorDetails.js";
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
    const [isEditingEventTitle, setIsEditingEventTitle] = useState(false);
    const [eventTitleDraft, setEventTitleDraft] = useState("");
    const [eventTitleError, setEventTitleError] = useState<string | null>(null);
    const [isSavingEventTitle, setIsSavingEventTitle] = useState(false);
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
    const selectedEventEvidence = useMemo(() => selectedEvent ? getEventEvidence(taskDetail?.task.runtimeSource, selectedEvent) : null, [selectedEvent, taskDetail?.task.runtimeSource]);
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
        setIsEditingEventTitle(false);
        setEventTitleDraft(selectedEventDisplayTitle ?? "");
        setEventTitleError(null);
        setIsSavingEventTitle(false);
    }, [selectedEventDisplayTitle]);
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
    async function handleEventTitleSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!selectedEvent || !canEditSelectedEventTitle) {
            return;
        }
        const trimmed = eventTitleDraft.trim();
        if (!trimmed) {
            setEventTitleError("Title cannot be empty.");
            return;
        }
        setIsSavingEventTitle(true);
        setEventTitleError(null);
        try {
            await onUpdateEventDisplayTitle(selectedEvent.id, trimmed);
            setIsEditingEventTitle(false);
        }
        catch (error) {
            setEventTitleError(error instanceof Error ? error.message : "Failed to save event title.");
        }
        finally {
            setIsSavingEventTitle(false);
        }
    }
    async function handleResetEventTitle(): Promise<void> {
        if (!selectedEvent || !canEditSelectedEventTitle) {
            return;
        }
        setIsSavingEventTitle(true);
        setEventTitleError(null);
        try {
            await onUpdateEventDisplayTitle(selectedEvent.id, null);
            setIsEditingEventTitle(false);
        }
        catch (error) {
            setEventTitleError(error instanceof Error ? error.message : "Failed to reset event title.");
        }
        finally {
            setIsSavingEventTitle(false);
        }
    }
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

        {activeTab === "inspector" ? (<>
            <div className="px-4 pt-4">
              <InspectorHeaderCard actions={(<>
                    <div className="flex flex-wrap items-center gap-2">
              <Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={onCreateTaskBookmark} size="sm" type="button" variant="ghost">
                      {selectedTaskBookmark ? "Task Saved" : "Save Task"}
                      </Button>
                      {selectedEvent && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={onCreateEventBookmark} size="sm" type="button" variant="ghost">
                          {selectedEventBookmark ? "Card Saved" : "Save Card"}
                        </Button>)}
                      {selectedEvent && canEditSelectedEventTitle && !isEditingEventTitle && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={() => {
                        setEventTitleDraft(selectedEventDisplayTitle ?? "");
                        setEventTitleError(null);
                        setIsEditingEventTitle(true);
                    }} size="sm" type="button" variant="ghost">
                          Rename Card
                        </Button>)}
                      {selectedEvent && canEditSelectedEventTitle && selectedEventDisplayTitleOverride && !isEditingEventTitle && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" onClick={() => { void handleResetEventTitle(); }} size="sm" type="button" variant="ghost">
                          Reset Title
                        </Button>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    {selectedConnector ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">
                        {selectedConnector.connector.isExplicit ? "relation" : "transition"} · {selectedConnector.connector.cross ? "cross-lane" : "same-lane"}
                      </Badge>) : selectedEvent ? (<Badge tone="neutral" size="xs" className="uppercase tracking-[0.06em]">{selectedEvent.kind} · {selectedEvent.lane}</Badge>) : null}
                    {selectedEventEvidence && (<Badge tone={evidenceTone(selectedEventEvidence.level)} size="xs">
                        {formatEvidenceLevel(selectedEventEvidence.level)}
                      </Badge>)}
                    {eventTime && <Badge tone="accent" size="xs">{eventTime}</Badge>}
                    </div>
                  </>)} description={selectedConnector
                ? `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} linking ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`
                : selectedEvent
                    ? `${selectedEvent.kind} in ${selectedEvent.lane}.`
                    : "Choose an event or connector to inspect its full timeline context."} eyebrow="Inspector" title={selectedConnector
                ? `${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title} → ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
                : selectedEventDisplayTitle ?? "Select an event"}>
                {selectedEvent && canEditSelectedEventTitle && isEditingEventTitle && (<form className="mt-4 flex flex-col gap-2" onSubmit={(event) => { void handleEventTitleSubmit(event); }}>
                    <input className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[0.84rem] text-[var(--text-1)] outline-none transition-colors focus:border-[var(--accent)]" disabled={isSavingEventTitle} onChange={(event) => setEventTitleDraft(event.target.value)} placeholder="Short title for this card" type="text" value={eventTitleDraft}/>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button className="h-7 rounded-[var(--radius-md)] border-[var(--accent)] bg-[var(--accent-light)] px-2.5 text-[0.72rem] font-semibold text-[var(--accent)] shadow-none hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]" disabled={isSavingEventTitle} size="sm" type="submit">
                        {isSavingEventTitle ? "Saving..." : "Save"}
                      </Button>
                      <Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" disabled={isSavingEventTitle} onClick={() => {
                    setEventTitleDraft(selectedEventDisplayTitle ?? "");
                    setEventTitleError(null);
                    setIsEditingEventTitle(false);
                }} size="sm" type="button">
                        Cancel
                      </Button>
                      {selectedEventDisplayTitleOverride && (<Button className="h-7 rounded-[var(--radius-md)] px-2.5 text-[0.72rem] font-semibold shadow-none" disabled={isSavingEventTitle} onClick={() => { void handleResetEventTitle(); }} size="sm" type="button">
                          Reset to Raw
                        </Button>)}
                    </div>
                    <p className="m-0 text-[0.76rem] text-[var(--text-3)]">
                      Raw event title is preserved. This only changes the inspector display title.
                    </p>
                    {eventTitleError && <p className="m-0 text-[0.76rem] font-medium text-[var(--err)]">{eventTitleError}</p>}
                  </form>)}
              </InspectorHeaderCard>
            </div>

            {selectedConnector ? (<div className="flex flex-col gap-5 px-4 py-5">
                <DetailSection label="Full Context" resizable value={[
                    `${selectedConnector.connector.isExplicit ? "Explicit relation" : "Fallback sequence"} from ${selectedConnector.source.lane} to ${selectedConnector.target.lane}.`,
                    selectedConnector.connector.label ? `Label: ${selectedConnector.connector.label}` : undefined,
                    selectedConnector.connector.explanation,
                    `From: ${buildInspectorEventTitle(selectedConnector.source) ?? selectedConnector.source.title}`,
                    `To: ${buildInspectorEventTitle(selectedConnector.target) ?? selectedConnector.target.title}`
                ].filter((value): value is string => Boolean(value)).join("\n")}/>
                <DetailConnectorIds connector={selectedConnector.connector} source={selectedConnector.source} target={selectedConnector.target}/>
                <DetailTags title="Transition Tags" values={[
                    selectedConnector.connector.isExplicit ? "explicit" : "inferred",
                    selectedConnector.connector.cross ? "cross-lane" : "same-lane",
                    selectedConnector.source.lane,
                    selectedConnector.target.lane,
                    selectedConnector.connector.relationType ?? "relates_to"
                ]}/>
                <DetailConnectorEvents source={selectedConnector.source} target={selectedConnector.target}/>
                <DetailSection label="Metadata" mono value={JSON.stringify({
                    connectorKey: selectedConnector.connector.key,
                    sourceEventId: selectedConnector.source.id,
                    targetEventId: selectedConnector.target.id,
                    sourceLane: selectedConnector.source.lane,
                    targetLane: selectedConnector.target.lane,
                    relationType: selectedConnector.connector.relationType,
                    relationLabel: selectedConnector.connector.label,
                    relationExplanation: selectedConnector.connector.explanation,
                    isExplicit: selectedConnector.connector.isExplicit,
                    workItemId: selectedConnector.connector.workItemId,
                    goalId: selectedConnector.connector.goalId,
                    planId: selectedConnector.connector.planId,
                    handoffId: selectedConnector.connector.handoffId
                }, null, 2)}/>
              </div>) : selectedEvent ? (<div className="flex flex-col gap-5 px-4 py-5">
                <DetailSection label="Full Context" resizable value={selectedEvent.body
                    ?? (selectedEvent.metadata["description"] as string | undefined)
                    ?? (selectedEvent.metadata["command"] as string | undefined)
                    ?? (selectedEvent.metadata["result"] as string | undefined)
                    ?? (selectedEvent.metadata["action"] as string | undefined)
                    ?? (selectedEvent.metadata["ruleId"] as string | undefined)
                    ?? "—"}/>
                <DetailIds event={selectedEvent} runtimeSessionId={taskDetail?.runtimeSessionId}/>
                <DetailEventEvidence event={selectedEvent} {...(taskDetail?.task.runtimeSource ? { runtimeSource: taskDetail.task.runtimeSource } : {})}/>
                {selectedEvent.kind === "question.logged" && (() => {
                    const qId = selectedEvent.metadata["questionId"] as string | undefined;
                    const group = qId ? questionGroups.find((g) => g.questionId === qId) : null;
                    return group ? <QuestionGroupSection group={group}/> : null;
                })()}
                {selectedEvent.kind === "todo.logged" && (() => {
                    const tId = selectedEvent.metadata["todoId"] as string | undefined;
                    const group = tId ? todoGroups.find((g) => g.todoId === tId) : null;
                    return group ? <TodoGroupSection group={group}/> : null;
                })()}
                {selectedEvent.lane === "coordination" && (<DetailSection label="Agent Activity" resizable value={[
                        typeof selectedEvent.metadata["activityType"] === "string"
                            ? `Activity: ${selectedEvent.metadata["activityType"]}`
                            : undefined,
                        typeof selectedEvent.metadata["agentName"] === "string"
                            ? `Agent: ${selectedEvent.metadata["agentName"]}`
                            : undefined,
                        typeof selectedEvent.metadata["skillName"] === "string"
                            ? `Skill: ${selectedEvent.metadata["skillName"]}`
                            : undefined,
                        typeof selectedEvent.metadata["skillPath"] === "string"
                            ? `Skill path: ${selectedEvent.metadata["skillPath"]}`
                            : undefined,
                        typeof selectedEvent.metadata["mcpServer"] === "string"
                            ? `MCP server: ${selectedEvent.metadata["mcpServer"]}`
                            : undefined,
                        typeof selectedEvent.metadata["mcpTool"] === "string"
                            ? `MCP tool: ${selectedEvent.metadata["mcpTool"]}`
                            : undefined
                    ].filter((value): value is string => Boolean(value)).join("\n") || "No coordination metadata"}/>)}
                {relatedEvents.length > 0 && <DetailRelatedEvents events={relatedEvents}/>}
                {selectedEvent.kind === "user.message" && <DetailCaptureInfo event={selectedEvent}/>}
                {selectedEvent.kind === "assistant.response" && <DetailTokenUsage event={selectedEvent}/>}
                {(selectedEvent.metadata["modelName"] as string | undefined) && (<DetailModelInfo modelName={selectedEvent.metadata["modelName"] as string} modelProvider={selectedEvent.metadata["modelProvider"] as string | undefined}/>)}
                <DetailTags title="Tags" values={selectedEvent.classification.tags} activeValue={selectedTag} onSelect={(tag) => onSelectTag(selectedTag === tag ? null : tag)}/>
                <DetailMatchList event={selectedEvent} activeRuleId={selectedRuleId} onSelectRule={(ruleId) => {
                    onSelectRule(selectedRuleId === ruleId ? null : ruleId);
                }}/>
                <DetailSection label="Metadata" mono value={JSON.stringify(selectedEvent.metadata, null, 2)}/>
              </div>) : (<div className="px-4 py-8 text-center">
                <p className="m-0 text-[0.9rem] font-medium text-[var(--text-2)]">No event selected.</p>
                <p className="mt-2 text-[0.8rem] text-[var(--text-3)]">
                  As soon as the monitor records activity, the latest item appears here.
                </p>
                {onOpenTaskWorkspace && (<div className="mt-4">
                    <Button className="h-8 rounded-full px-3 text-[0.76rem] font-semibold shadow-none whitespace-nowrap" onClick={onOpenTaskWorkspace} size="sm" type="button">
                      {openWorkspaceLabel}
                    </Button>
                  </div>)}
              </div>)}

            {showInspectorSummaryFooter && obsBadges.length > 0 && (<div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
                {obsBadges.map((b) => (<Badge key={b.key} tone={b.tone} size="xs" className="gap-1 px-2.5 py-1 text-[0.68rem]">
                    <strong>{b.value}</strong>
                    <span>{b.label}</span>
                  </Badge>))}
              </div>)}
            {showInspectorSummaryFooter && taskModelSummary && (<div className="px-4 pb-4">
                <DetailTaskModel summary={taskModelSummary}/>
              </div>)}
          </>) : activeTab === "overview" ? (<OverviewTab observability={observability} subagentInsight={subagentInsight} verificationCycles={verificationCycles} runtimeSessionId={taskDetail?.runtimeSessionId} runtimeSource={taskDetail?.runtimeSource} workspacePath={taskDetail?.task.workspacePath}/>) : activeTab === "evidence" ? (<EvidenceTab tagInsights={tagInsights} selectedTag={selectedTag} sortedFileActivity={sortedFileActivity} workspacePath={taskDetail?.task.workspacePath} isFileActivityExpanded={isFileActivityExpanded} fileSortKey={fileSortKey} explorationInsight={explorationInsight} webLookups={webLookups} sortedExploredFiles={sortedExploredFiles} isExploredFilesExpanded={isExploredFilesExpanded} explorationSortKey={explorationSortKey} mentionedVerifications={mentionedVerifications} onSelectTag={(tag) => onSelectTag(selectedTag === tag ? null : tag)} onToggleFileActivity={() => setIsFileActivityExpanded((current) => !current)} onFileSortChange={setFileSortKey} onToggleExploredFiles={() => setIsExploredFilesExpanded((current) => !current)} onExplorationSortChange={setExplorationSortKey}/>) : (<ActionsTab taskId={taskDetail?.task.id} taskTitle={selectedTaskTitle ?? taskDetail?.task.title ?? ""} workspacePath={taskDetail?.task.workspacePath} taskExtraction={taskExtraction} taskTimeline={taskTimeline} handoffPlans={handoffPlans} handoffExploredFiles={handoffExploredFiles} handoffModifiedFiles={handoffModifiedFiles} handoffOpenTodos={handoffOpenTodos} handoffOpenQuestions={handoffOpenQuestions} handoffViolations={handoffViolations} handoffSnapshot={handoffSnapshot} evaluation={taskEvaluation} isSavingEvaluation={isSavingTaskEvaluation} isSavedEvaluation={isSavedTaskEvaluation} onSaveEvaluation={saveTaskEvaluation}/>)}
      </div>
    </aside>);
}
