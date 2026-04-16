import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EventId } from "@monitor/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { postRuleAction, updateEventDisplayTitle } from "@monitor/web-core";
import { EventInspector, type PanelTabId } from "../components/EventInspector.js";
import { runtimeObservabilityLabel, runtimeTagLabel } from "../components/TaskList.js";
import { Timeline } from "../components/Timeline.js";
import { buildTaskTimelineSummary } from "@monitor/web-core";
import { buildTaskWorkspaceSelection, useTaskObservability } from "@monitor/web-core";
import { refreshRealtimeMonitorData } from "@monitor/web-core";
import { cn } from "../lib/ui/cn.js";
import { Button } from "../components/ui/Button.js";
import { useMonitorStore } from "@monitor/web-store";
import { useWebSocket } from "@monitor/web-store";
const DEFAULT_WORKSPACE_TAB: PanelTabId = "overview";
const WORKSPACE_INSPECTOR_MIN_WIDTH = 340;
const WORKSPACE_INSPECTOR_MAX_WIDTH = 680;
const WORKSPACE_INSPECTOR_DEFAULT_WIDTH = 360;
const WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY = "agent-tracer.workspace-inspector-width";
const REVIEWER_ID_STORAGE_KEY = "agent-tracer.reviewer-id";
const WORKSPACE_TAB_MAP: Record<string, PanelTabId> = {
    inspector: "inspector",
    overview: "overview",
    evidence: "evidence",
    actions: "actions",
    flow: "overview",
    health: "overview",
    tags: "evidence",
    files: "evidence",
    exploration: "evidence",
    task: "actions",
    compact: "actions",
    evaluate: "actions"
};
export function normalizeWorkspaceTab(value: string | null): PanelTabId {
    if (!value) {
        return DEFAULT_WORKSPACE_TAB;
    }
    return WORKSPACE_TAB_MAP[value] ?? DEFAULT_WORKSPACE_TAB;
}
function isTaskNotFound(errorMessage: string | null): boolean {
    return errorMessage === "Task not found.";
}
export function TaskWorkspacePage({ taskId, embedded = false }: {
    readonly taskId: string;
    readonly embedded?: boolean;
}): React.JSX.Element {
    const { state, dispatch, refreshOverview, refreshTaskDetail, refreshBookmarksOnly, handleCreateTaskBookmark, handleCreateEventBookmark, handleTaskStatusChange, handleTaskTitleSubmit } = useMonitorStore();
    const { bookmarks, selectedTaskId, selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag, showRuleGapsOnly, taskDetail, nowMs, isEditingTaskTitle, taskTitleDraft, taskTitleError, isSavingTaskTitle, isUpdatingTaskStatus, taskDisplayTitleCache } = state;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { taskObservability, refreshTaskObservability } = useTaskObservability(taskId);
    const [reviewerNote, setReviewerNote] = useState("");
    const [isSubmittingRuleReview, setIsSubmittingRuleReview] = useState(false);
    const [reviewerId, setReviewerId] = useState(() => window.localStorage.getItem(REVIEWER_ID_STORAGE_KEY) ?? "local-reviewer");
    const [zoom, setZoom] = useState(1.1);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    // Controls/Filters state for embedded workspace header buttons
    const [isWorkspaceControlsOpen, setIsWorkspaceControlsOpen] = useState(false);
    const [isWorkspaceFiltersOpen, setIsWorkspaceFiltersOpen] = useState(false);
    const [workspaceControlsPos, setWorkspaceControlsPos] = useState({ top: 0, right: 0 });
    const [workspaceFiltersPos, setWorkspaceFiltersPos] = useState({ top: 0, right: 0 });
    const workspaceControlsButtonRef = useRef<HTMLButtonElement>(null);
    const workspaceFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
        const raw = window.localStorage.getItem(WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY);
        if (!raw)
            return WORKSPACE_INSPECTOR_DEFAULT_WIDTH;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed))
            return WORKSPACE_INSPECTOR_DEFAULT_WIDTH;
        return Math.max(WORKSPACE_INSPECTOR_MIN_WIDTH, Math.min(WORKSPACE_INSPECTOR_MAX_WIDTH, parsed));
    });
    useWebSocket((message) => {
        void refreshRealtimeMonitorData({
            message,
            selectedTaskId: taskId,
            dispatch,
            refreshOverview,
            refreshTaskDetail,
            refreshBookmarksOnly
        });
        void refreshTaskObservability();
    });
    useLayoutEffect(() => {
        if (selectedTaskId === taskId) {
            return;
        }
        dispatch({ type: "SELECT_TASK", taskId });
    }, [dispatch, selectedTaskId, taskId]);
    useEffect(() => {
        window.localStorage.setItem(REVIEWER_ID_STORAGE_KEY, reviewerId);
    }, [reviewerId]);
    useEffect(() => {
        window.localStorage.setItem(WORKSPACE_INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorWidth));
    }, [inspectorWidth]);
    useEffect(() => {
        const handleResize = (): void => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    const activeTab = useMemo(() => normalizeWorkspaceTab(searchParams.get("tab")), [searchParams]);
    useEffect(() => {
        const currentTab = searchParams.get("tab");
        if (currentTab === activeTab) {
            return;
        }
        navigate(`/tasks/${encodeURIComponent(taskId)}?tab=${activeTab}`, { replace: true });
    }, [activeTab, searchParams, navigate, taskId]);
    const selectedTaskDetail = taskDetail?.task.id === taskId ? taskDetail : null;
    const taskTimeline = selectedTaskDetail?.timeline ?? [];
    const selectedTaskDisplayTitle = useMemo(() => selectedTaskDetail?.task
        ? (taskDisplayTitleCache[selectedTaskDetail.task.id]?.title ?? selectedTaskDetail.task.title)
        : null, [selectedTaskDetail, taskDisplayTitleCache]);
    const selectedTaskUsesDerivedTitle = Boolean(selectedTaskDetail?.task
        && selectedTaskDisplayTitle
        && selectedTaskDisplayTitle.trim() !== selectedTaskDetail.task.title.trim());
    const { recentRuleDecisions, observabilityStats, modelSummary } = useMemo(() => buildTaskTimelineSummary(taskTimeline), [taskTimeline]);
    const workspaceSelection = useMemo(() => buildTaskWorkspaceSelection({
        timeline: taskTimeline,
        selectedConnectorKey,
        selectedEventId,
        selectedRuleId,
        selectedTag,
        showRuleGapsOnly,
        taskDisplayTitle: selectedTaskDisplayTitle
    }), [selectedConnectorKey, selectedEventId, selectedRuleId, selectedTag, selectedTaskDisplayTitle, showRuleGapsOnly, taskTimeline]);
    const { selectedConnector, selectedEvent, selectedEventDisplayTitle } = workspaceSelection;
    const selectedTaskBookmark = useMemo(() => bookmarks.find((bookmark) => bookmark.taskId === taskId && !bookmark.eventId) ?? null, [bookmarks, taskId]);
    const selectedEventBookmark = selectedEvent
        ? bookmarks.find((bookmark) => bookmark.eventId === selectedEvent.id) ?? null
        : null;
    const workspaceMissingTask = isTaskNotFound(state.errorMessage)
        && selectedTaskId === taskId
        && !selectedTaskDetail;
    const workspaceLoading = !workspaceMissingTask && (!selectedTaskDetail || selectedTaskId !== taskId);
    const isStackedWorkspace = viewportWidth < 1024;
    const workspaceLayoutStyle = useMemo(() => (isStackedWorkspace
        ? undefined
        : ({ gridTemplateColumns: `minmax(0, 1fr) ${inspectorWidth}px` } as React.CSSProperties)), [inspectorWidth, isStackedWorkspace]);
    const handleInspectorResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
        if (event.button !== 0 || isStackedWorkspace)
            return;
        const startX = event.clientX;
        const startWidth = inspectorWidth;
        const onMove = (moveEvent: PointerEvent): void => {
            const delta = startX - moveEvent.clientX;
            const nextWidth = Math.max(WORKSPACE_INSPECTOR_MIN_WIDTH, Math.min(WORKSPACE_INSPECTOR_MAX_WIDTH, Math.round(startWidth + delta)));
            setInspectorWidth(nextWidth);
        };
        const onUp = (): void => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            document.body.classList.remove("is-resizing-inspector");
        };
        document.body.classList.add("is-resizing-inspector");
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        event.preventDefault();
    }, [inspectorWidth, isStackedWorkspace]);
    const handleActiveTabChange = useCallback((tab: PanelTabId): void => {
        navigate(`/tasks/${encodeURIComponent(taskId)}?tab=${tab}`, { replace: true });
    }, [navigate, taskId]);
    const handleRuleReview = useCallback(async (outcome: "approved" | "rejected" | "bypassed"): Promise<void> => {
        if (!selectedTaskDetail?.task || !taskObservability?.observability.ruleEnforcement.activeRuleId) {
            return;
        }
        setIsSubmittingRuleReview(true);
        try {
            await postRuleAction({
                taskId: selectedTaskDetail.task.id,
                action: "review_rule_gate",
                title: outcome === "approved"
                    ? "Approval granted"
                    : outcome === "rejected"
                        ? "Approval rejected"
                        : "Rule bypassed",
                ruleId: taskObservability.observability.ruleEnforcement.activeRuleId,
                severity: outcome === "approved" ? "info" : "warn",
                status: outcome === "approved" || outcome === "bypassed" ? "pass" : "violation",
                source: "workspace-review",
                metadata: {
                    reviewerId,
                    reviewerSource: "workspace-review"
                },
                ...(reviewerNote.trim() ? { body: reviewerNote.trim() } : {}),
                outcome
            });
            setReviewerNote("");
            await Promise.all([
                refreshOverview(),
                refreshTaskDetail(taskId),
                refreshTaskObservability()
            ]);
        }
        finally {
            setIsSubmittingRuleReview(false);
        }
    }, [refreshOverview, refreshTaskDetail, refreshTaskObservability, reviewerId, reviewerNote, selectedTaskDetail?.task, taskId, taskObservability?.observability.ruleEnforcement.activeRuleId]);
    const timelineEmbeddedProps = embedded ? {
        externalControlsState: { isOpen: isWorkspaceControlsOpen, setIsOpen: setIsWorkspaceControlsOpen, popoverPos: workspaceControlsPos, setPopoverPos: setWorkspaceControlsPos, buttonRef: workspaceControlsButtonRef },
        externalFiltersState: { isOpen: isWorkspaceFiltersOpen, setIsOpen: setIsWorkspaceFiltersOpen, popoverPos: workspaceFiltersPos, setPopoverPos: setWorkspaceFiltersPos, buttonRef: workspaceFiltersButtonRef }
    } : {};
    return (<div className={embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex h-dvh flex-col overflow-hidden bg-[var(--bg)]"}>
      <header className={embedded
          ? "flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3"
          : "flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,var(--bg))] px-4 py-2.5 shadow-[var(--shadow-1)]"}>
        {embedded ? (<>
          <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
            <button
              aria-label="Back to task list"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-3)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_36%,var(--border))] hover:text-[var(--text-2)]"
              onClick={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}
              title="Back to task list"
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="12">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span className="truncate text-[0.88rem] font-semibold text-[var(--text-1)]">
              {selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? taskId}
            </span>
            {selectedTaskDetail?.task && (<span className={cn("inline-flex shrink-0 items-center rounded-[var(--radius-md)] border px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.06em]", selectedTaskDetail.task.status === "running"
                ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                : selectedTaskDetail.task.status === "waiting"
                    ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]"
                    : selectedTaskDetail.task.status === "completed"
                        ? "border-[var(--accent-light)] bg-[var(--accent-light)] text-[var(--accent)]"
                        : "border-[var(--err-bg)] bg-[var(--err-bg)] text-[var(--err)]")}>
              {selectedTaskDetail.task.status}
            </span>)}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              ref={workspaceControlsButtonRef}
              aria-expanded={isWorkspaceControlsOpen || isEditingTaskTitle}
              aria-label="Open task controls"
              className={cn("timeline-context-toggle", (isWorkspaceControlsOpen || isEditingTaskTitle) && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")}
              onClick={() => {
                if (workspaceControlsButtonRef.current) {
                    const rect = workspaceControlsButtonRef.current.getBoundingClientRect();
                    setWorkspaceControlsPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                }
                setIsWorkspaceControlsOpen((v) => !v);
              }}
              title="Task controls"
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
              <span className="hidden text-[0.72rem] font-medium sm:inline">Controls</span>
            </button>
            <button
              ref={workspaceFiltersButtonRef}
              aria-expanded={isWorkspaceFiltersOpen}
              aria-label="Open filters and zoom"
              className={cn("timeline-context-toggle", isWorkspaceFiltersOpen && "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]")}
              onClick={() => {
                if (workspaceFiltersButtonRef.current) {
                    const rect = workspaceFiltersButtonRef.current.getBoundingClientRect();
                    setWorkspaceFiltersPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                }
                setIsWorkspaceFiltersOpen((v) => !v);
              }}
              title="Filters & Zoom"
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
                <line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/>
              </svg>
              <span className="hidden text-[0.72rem] font-medium sm:inline">Filters</span>
            </button>
            {taskObservability?.observability.ruleEnforcement.activeState === "approval_required" && (<Button size="sm" variant="accent" onClick={() => void handleRuleReview("approved")} disabled={isSubmittingRuleReview}>
                Approve
              </Button>)}
            {(taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
              || taskObservability?.observability.ruleEnforcement.activeState === "blocked") && (<Button size="sm" variant="destructive" onClick={() => void handleRuleReview("rejected")} disabled={isSubmittingRuleReview}>
                Reject
              </Button>)}
            {(taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
              || taskObservability?.observability.ruleEnforcement.activeState === "blocked") && (<Button size="sm" onClick={() => void handleRuleReview("bypassed")} disabled={isSubmittingRuleReview}>
                Bypass
              </Button>)}
          </div>
        </>) : (<>
          <div className="min-w-0">
            <p className="m-0 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              Task Workspace
            </p>
            <h1 className="mt-1 break-words text-[0.96rem] leading-tight font-semibold tracking-[-0.02em] text-[var(--text-1)] sm:truncate">
              {selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? taskId}
            </h1>
            {selectedTaskDetail?.task && (<div className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem]">
                {selectedTaskDetail.task.runtimeSource && (<span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--text-2)] shadow-[var(--shadow-1)]">
                    {runtimeTagLabel(selectedTaskDetail.task.runtimeSource)}
                  </span>)}
                <span className={cn("inline-flex items-center rounded-[var(--radius-md)] border px-2.5 py-1 font-semibold uppercase tracking-[0.06em]", selectedTaskDetail.task.status === "running"
                  ? "border-[var(--ok-bg)] bg-[var(--ok-bg)] text-[var(--ok)]"
                  : selectedTaskDetail.task.status === "waiting"
                      ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)]"
                      : selectedTaskDetail.task.status === "completed"
                          ? "border-[var(--accent-light)] bg-[var(--accent-light)] text-[var(--accent)]"
                          : "border-[var(--err-bg)] bg-[var(--err-bg)] text-[var(--err)]")}>
                  {selectedTaskDetail.task.status}
                </span>
                {runtimeObservabilityLabel(selectedTaskDetail.task.runtimeSource) && (<span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--warn-bg)] bg-[var(--warn-bg)] px-2.5 py-1 font-semibold text-[var(--warn)]">
                    {runtimeObservabilityLabel(selectedTaskDetail.task.runtimeSource)}
                  </span>)}
                {taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
                  && selectedTaskDetail.task.status === "waiting" ? (<span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--accent-light)] bg-[var(--accent-light)] px-2.5 py-1 font-semibold text-[var(--accent)]">
                      {taskObservability.observability.ruleEnforcement.activeLabel
                      ? `approval required · ${taskObservability.observability.ruleEnforcement.activeLabel}`
                      : "approval required"}
                    </span>) : null}
                {taskObservability?.observability.ruleEnforcement.activeState === "blocked"
                  && selectedTaskDetail.task.status === "errored" ? (<span className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--err-bg)] bg-[var(--err-bg)] px-2.5 py-1 font-semibold text-[var(--err)]">
                      {taskObservability.observability.ruleEnforcement.activeLabel
                      ? `blocked by rule · ${taskObservability.observability.ruleEnforcement.activeLabel}`
                      : "blocked by rule"}
                    </span>) : null}
              </div>)}
            {selectedTaskDetail?.task.workspacePath && (<p className="mt-1 break-all font-mono text-[0.74rem] text-[var(--text-3)] sm:truncate">
                {selectedTaskDetail.task.workspacePath}
              </p>)}
          </div>
          <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
            {taskObservability?.observability.ruleEnforcement.activeState === "approval_required" && (<Button size="sm" variant="accent" onClick={() => void handleRuleReview("approved")} disabled={isSubmittingRuleReview}>
                Approve
              </Button>)}
            {(taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
              || taskObservability?.observability.ruleEnforcement.activeState === "blocked") && (<Button size="sm" variant="destructive" onClick={() => void handleRuleReview("rejected")} disabled={isSubmittingRuleReview}>
                Reject
              </Button>)}
            {(taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
              || taskObservability?.observability.ruleEnforcement.activeState === "blocked") && (<Button size="sm" onClick={() => void handleRuleReview("bypassed")} disabled={isSubmittingRuleReview}>
                Bypass
              </Button>)}
            <Button size="sm" onClick={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}>
              Dashboard
            </Button>
          </div>
        </>)}
      </header>

      <main className="flex flex-1 min-h-0 flex-col gap-3 p-3">
        {workspaceLoading ? (<section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-[var(--shadow-1)]">
            <div className="text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                Loading Workspace
              </p>
              <h2 className="mt-2 text-[1.05rem] font-semibold text-[var(--text-1)]">
                {taskId}
              </h2>
              <p className="mt-3 text-[0.88rem] leading-6 text-[var(--text-2)]">
                Fetching the task timeline and observability state from the local database.
              </p>
            </div>
          </section>) : workspaceMissingTask ? (<section className="flex min-h-0 flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 shadow-[var(--shadow-1)]">
            <div className="max-w-xl text-center">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
                Task Not Found
              </p>
              <h2 className="mt-2 text-[1.1rem] font-semibold text-[var(--text-1)]">
                {taskId}
              </h2>
              <p className="mt-3 text-[0.88rem] leading-6 text-[var(--text-2)]">
                This task does not exist in the current local database. The URL is preserved, but the workspace cannot load a timeline for it.
              </p>
              <div className="mt-5 flex justify-center">
                <Button size="sm" onClick={() => void navigate(`/?task=${encodeURIComponent(taskId)}`)}>
                  Back to Timeline
                </Button>
              </div>
            </div>
          </section>) : (<div className="grid flex-1 min-h-0 gap-3" style={workspaceLayoutStyle}>
            <section className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]", "min-h-[24rem]")}>
              <Timeline zoom={zoom} onZoomChange={setZoom} timeline={taskTimeline} taskTitle={selectedTaskDisplayTitle} taskWorkspacePath={selectedTaskDetail?.task.workspacePath} taskStatus={selectedTaskDetail?.task.status} taskUpdatedAt={selectedTaskDetail?.task.updatedAt} taskUsesDerivedTitle={selectedTaskUsesDerivedTitle} isEditingTaskTitle={isEditingTaskTitle} taskTitleDraft={taskTitleDraft} taskTitleError={taskTitleError} isSavingTaskTitle={isSavingTaskTitle} isUpdatingTaskStatus={isUpdatingTaskStatus} selectedEventId={selectedEventId} selectedConnectorKey={selectedConnectorKey} selectedRuleId={selectedRuleId} selectedTag={selectedTag} showRuleGapsOnly={showRuleGapsOnly} nowMs={nowMs} observabilityStats={observabilityStats} onSelectEvent={(id) => {
                dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
                dispatch({ type: "SELECT_EVENT", eventId: id });
            }} onSelectConnector={(key) => {
                dispatch({ type: "SELECT_CONNECTOR", connectorKey: key });
                dispatch({ type: "SELECT_EVENT", eventId: null });
            }} onStartEditTitle={() => {
                dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? "" });
                dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
                dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: true });
            }} onCancelEditTitle={() => {
                dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? selectedTaskDetail?.task.title ?? "" });
                dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
                dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
            }} onSubmitTitle={(event) => void handleTaskTitleSubmit(event, taskTitleDraft)} onTitleDraftChange={(value) => dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: value })} onClearFilters={() => {
                dispatch({ type: "SELECT_RULE", ruleId: null });
                dispatch({ type: "SELECT_TAG", tag: null });
                dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
            }} onToggleRuleGap={(show) => dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show })} onClearRuleId={() => dispatch({ type: "SELECT_RULE", ruleId: null })} onClearTag={() => dispatch({ type: "SELECT_TAG", tag: null })} onChangeTaskStatus={(status) => void handleTaskStatusChange(status)} embedded={embedded} {...timelineEmbeddedProps}/>
            </section>

            <div className="relative flex min-h-0 min-w-0 flex-col">
              {(taskObservability?.observability.ruleEnforcement.activeState === "approval_required"
                || taskObservability?.observability.ruleEnforcement.activeState === "blocked") && (<section className="mb-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-1)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Review decision</p>
                      <p className="mt-1 text-[0.84rem] text-[var(--text-2)]">
                        {taskObservability.observability.ruleEnforcement.activeLabel
                    ? `Active rule: ${taskObservability.observability.ruleEnforcement.activeLabel}`
                    : "A rule guard is currently active for this task."}
                      </p>
                    </div>
                  </div>
                  <textarea className="mt-3 min-h-[78px] w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.82rem] leading-6" onChange={(event) => setReviewerNote(event.target.value)} placeholder="Optional reviewer note" value={reviewerNote}/>
                  <input className="mt-3 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[0.82rem]" onChange={(event) => setReviewerId(event.target.value)} placeholder="Reviewer identity" value={reviewerId}/>
                  {recentRuleDecisions.length > 0 && (<div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)]">Recent decisions</p>
                      <div className="mt-2 flex flex-col gap-2">
                        {recentRuleDecisions.slice(0, 3).map((decision) => (<div key={decision.id} className="text-[0.78rem] text-[var(--text-2)]">
                            <strong className="text-[var(--text-1)]">{decision.ruleId}</strong>
                            {" · "}
                            {decision.outcome ?? decision.status}
                            {decision.reviewerId ? ` · ${decision.reviewerId}` : ""}
                            {decision.note ? ` — ${decision.note}` : ""}
                          </div>))}
                      </div>
                    </div>)}
                </section>)}
              {!isStackedWorkspace && (<div aria-label="Resize workspace inspector panel" aria-orientation="vertical" className="inspector-resizer absolute left-[-9px] top-2 bottom-2 z-10 w-3 cursor-col-resize before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--border)_74%,transparent)] before:transition-colors hover:before:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]" onPointerDown={handleInspectorResizeStart} role="separator"/>)}
              <EventInspector activeTab={activeTab} className="min-h-[24rem]" isCollapsed={false} onActiveTabChange={handleActiveTabChange} onCreateEventBookmark={() => {
                if (!selectedEvent)
                    return;
                void handleCreateEventBookmark(selectedEvent.id, selectedEventDisplayTitle ?? selectedEvent.title).catch((error) => {
                    dispatch({
                        type: "SET_STATUS",
                        status: "error",
                        errorMessage: error instanceof Error ? error.message : "Failed to save event bookmark."
                    });
                });
            }} onCreateTaskBookmark={() => {
                void handleCreateTaskBookmark().catch((error) => {
                    dispatch({
                        type: "SET_STATUS",
                        status: "error",
                        errorMessage: error instanceof Error ? error.message : "Failed to save task bookmark."
                    });
                });
            }} onSelectRule={(ruleId) => {
                dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
                dispatch({ type: "SELECT_RULE", ruleId });
            }} onSelectTag={(tag) => dispatch({ type: "SELECT_TAG", tag })} onToggleCollapse={() => { }} onUpdateEventDisplayTitle={async (eventId, displayTitle) => {
            await updateEventDisplayTitle(EventId(eventId), displayTitle);
            await refreshTaskDetail(taskId);
        }} selectedConnector={selectedConnector} selectedEvent={selectedEvent} selectedEventBookmark={selectedEventBookmark} selectedEventDisplayTitle={selectedEventDisplayTitle} selectedRuleId={selectedRuleId} selectedTag={selectedTag} selectedTaskBookmark={selectedTaskBookmark} selectedTaskTitle={selectedTaskDisplayTitle} showCollapseControl={false} taskDetail={selectedTaskDetail} taskModelSummary={modelSummary} taskObservability={taskObservability}/>
            </div>
          </div>)}
      </main>
    </div>);
}
