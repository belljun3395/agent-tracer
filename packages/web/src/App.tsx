/**
 * 대시보드 루트 컴포넌트.
 * 레이아웃 조합만 담당. 데이터 페칭·소켓·검색은 store hooks에 위임.
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildCompactInsight,
  buildModelSummary,
  buildObservabilityStats,
  buildQuestionGroups,
  buildTodoGroups,
  collectExploredFiles,
  filterTimelineEvents
} from "./lib/insights.js";
import { buildTimelineRelations } from "./lib/timeline.js";
import { refreshRealtimeMonitorData } from "./lib/realtime.js";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { TaskList } from "./components/TaskList.js";
import { Timeline } from "./components/Timeline.js";
import { EventInspector } from "./components/EventInspector.js";
import { MonitorProvider, useMonitorStore } from "./store/useMonitorStore.js";
import { useWebSocket } from "./store/useWebSocket.js";
import { useSearch } from "./store/useSearch.js";

// ---------------------------------------------------------------------------
// Connector key helpers (App 내부에서만 사용)
// ---------------------------------------------------------------------------

function parseConnectorKey(
  key: string
): { sourceEventId: string; targetEventId: string; relationType?: string } | null {
  const [sourceEventId, targetPart] = key.split("→");
  if (!sourceEventId || !targetPart) return null;
  const [targetEventId, relationType] = targetPart.split(":");
  if (!targetEventId) return null;
  return { sourceEventId, targetEventId, ...(relationType ? { relationType } : {}) };
}

// ---------------------------------------------------------------------------
// Sidebar resize constants
// ---------------------------------------------------------------------------

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 220;
const SIDEBAR_WIDTH_STORAGE_KEY = "agent-tracer.sidebar-width";

const INSPECTOR_MIN_WIDTH = 280;
const INSPECTOR_MAX_WIDTH = 560;
const INSPECTOR_DEFAULT_WIDTH = 340;
const INSPECTOR_WIDTH_STORAGE_KEY = "agent-tracer.inspector-width";

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";

// ---------------------------------------------------------------------------
// Inner dashboard (consumes context)
// ---------------------------------------------------------------------------

function Dashboard(): React.JSX.Element {
  const {
    state,
    dispatch,
    refreshOverview,
    refreshTaskDetail,
    handleDeleteTask,
    handleCreateTaskBookmark,
    handleCreateEventBookmark,
    handleDeleteBookmark,
    handleTaskStatusChange,
    handleTaskTitleSubmit
  } = useMonitorStore();

  const {
    tasks,
    bookmarks,
    selectedTaskId,
    selectedEventId,
    selectedConnectorKey,
    selectedRuleId,
    selectedTag,
    showRuleGapsOnly,
    taskDetail,
    isConnected,
    status,
    errorMessage,
    deletingTaskId,
    deleteErrorTaskId,
    nowMs,
    isEditingTaskTitle,
    taskTitleDraft,
    taskTitleError,
    isSavingTaskTitle,
    isUpdatingTaskStatus,
    taskDisplayTitleCache
  } = state;

  // WebSocket: message 수신 시 overview + taskDetail 새로고침
  const { isConnected: wsConnected } = useWebSocket(() => {
    void refreshRealtimeMonitorData({
      selectedTaskId,
      refreshOverview,
      refreshTaskDetail
    });
  });

  // isConnected는 WebSocket 상태로부터 동기화
  useEffect(() => {
    dispatch({ type: "SET_CONNECTED", isConnected: wsConnected });
  }, [dispatch, wsConnected]);

  // Search — selectedTaskId を渡すとタスク単位検索が可能になる
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isSearching,
    taskScopeEnabled,
    setTaskScopeEnabled
  } = useSearch(selectedTaskId ?? undefined);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed));
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const sidebarResizeRef = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
    if (!raw) return INSPECTOR_DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return INSPECTOR_DEFAULT_WIDTH;
    return Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, parsed));
  });
  const inspectorResizeRef = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);

  const [zoom, setZoom] = useState<number>(() => {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (!raw) return ZOOM_DEFAULT;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return ZOOM_DEFAULT;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  useEffect(() => {
    window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    const handleResize = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const onSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isSidebarCollapsed) return;
    sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };

    const onMove = (moveEvent: PointerEvent): void => {
      const current = sidebarResizeRef.current;
      if (!current) return;
      const delta = moveEvent.clientX - current.startX;
      const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(current.startWidth + delta)));
      setSidebarWidth(clamped);
    };

    const onUp = (): void => {
      sidebarResizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("is-resizing-sidebar");
    };

    document.body.classList.add("is-resizing-sidebar");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    event.preventDefault();
  }, [isSidebarCollapsed, sidebarWidth]);

  const onInspectorResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isInspectorCollapsed) return;
    inspectorResizeRef.current = { startX: event.clientX, startWidth: inspectorWidth };

    const onMove = (moveEvent: PointerEvent): void => {
      const current = inspectorResizeRef.current;
      if (!current) return;
      // Inspector은 오른쪽에 있으므로 왼쪽으로 드래그할수록 너비 증가
      const delta = current.startX - moveEvent.clientX;
      const clamped = Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, Math.round(current.startWidth + delta)));
      setInspectorWidth(clamped);
    };

    const onUp = (): void => {
      inspectorResizeRef.current = null;
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
  }, [isInspectorCollapsed, inspectorWidth]);

  // ---------------------------------------------------------------------------
  // Derived / memoised values
  // ---------------------------------------------------------------------------

  const taskTimeline = taskDetail?.timeline ?? [];

  const selectedTaskDisplayTitle = useMemo(
    () => taskDetail?.task ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title) : null,
    [taskDetail, taskDisplayTitleCache]
  );

  const selectedTaskUsesDerivedTitle = Boolean(
    taskDetail?.task
    && selectedTaskDisplayTitle
    && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim()
  );

  const exploredFiles = useMemo(() => collectExploredFiles(taskTimeline), [taskTimeline]);
  const compactInsight = useMemo(() => buildCompactInsight(taskTimeline), [taskTimeline]);
  const observabilityStats = useMemo(
    () => buildObservabilityStats(taskTimeline, exploredFiles.length, compactInsight.occurrences),
    [compactInsight.occurrences, exploredFiles.length, taskTimeline]
  );
  const modelSummary = useMemo(() => buildModelSummary(taskTimeline), [taskTimeline]);
  const questionGroups = useMemo(() => buildQuestionGroups(taskTimeline), [taskTimeline]);
  const todoGroups = useMemo(() => buildTodoGroups(taskTimeline), [taskTimeline]);

  const filteredTimeline = useMemo(
    () => filterTimelineEvents(taskTimeline, {
      laneFilters: { user: true, questions: true, todos: true, background: true, coordination: true, exploration: true, planning: true, implementation: true },
      selectedRuleId,
      selectedTag,
      showRuleGapsOnly
    }),
    [selectedRuleId, selectedTag, showRuleGapsOnly, taskTimeline]
  );

  const selectedConnector = useMemo(() => {
    if (!selectedConnectorKey) return null;
    const parsed = parseConnectorKey(selectedConnectorKey);
    if (!parsed) return null;
    const source = taskTimeline.find((e) => e.id === parsed.sourceEventId);
    const target = taskTimeline.find((e) => e.id === parsed.targetEventId);
    if (!source || !target) return null;
    const relation = buildTimelineRelations(taskTimeline).find((item) =>
      item.sourceEventId === source.id
      && item.targetEventId === target.id
      && (item.relationType ?? undefined) === parsed.relationType
    );
    return {
      connector: {
        key: selectedConnectorKey,
        path: "",
        lane: target.lane,
        cross: source.lane !== target.lane,
        sourceEventId: source.id,
        targetEventId: target.id,
        sourceLane: source.lane,
        targetLane: target.lane,
        isExplicit: relation?.isExplicit ?? parsed.relationType !== "sequence",
        ...((relation?.relationType ?? parsed.relationType) !== undefined
          ? { relationType: relation?.relationType ?? parsed.relationType }
          : {}),
        ...(relation?.label !== undefined ? { label: relation.label } : {}),
        ...(relation?.explanation !== undefined ? { explanation: relation.explanation } : {}),
        ...(relation?.workItemId !== undefined ? { workItemId: relation.workItemId } : {}),
        ...(relation?.goalId !== undefined ? { goalId: relation.goalId } : {}),
        ...(relation?.planId !== undefined ? { planId: relation.planId } : {}),
        ...(relation?.handoffId !== undefined ? { handoffId: relation.handoffId } : {})
      },
      source,
      target
    };
  }, [selectedConnectorKey, taskTimeline]);

  const selectedTaskBookmark = useMemo(
    () => selectedTaskId
      ? bookmarks.find((b) => b.taskId === selectedTaskId && !b.eventId) ?? null
      : null,
    [bookmarks, selectedTaskId]
  );

  const selectedEvent = selectedConnector
    ? null
    : filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[0] ?? null;

  const selectedEventDisplayTitle = selectedEvent
    ? selectedEvent.kind === "task.start"
      ? selectedTaskDisplayTitle ?? selectedEvent.title
      : selectedEvent.title
    : null;

  const selectedEventBookmark = selectedEvent
    ? bookmarks.find((b) => b.eventId === selectedEvent.id) ?? null
    : null;

  // ---------------------------------------------------------------------------
  // Layout helpers
  // ---------------------------------------------------------------------------

  const dashboardStyle = useMemo(
    () => ({
      "--sidebar-width": `${sidebarWidth}px`,
      "--inspector-width": `${inspectorWidth}px`
    }) as React.CSSProperties,
    [sidebarWidth, inspectorWidth]
  );

  const dashboardColumns = viewportWidth < 960
    ? "!grid-cols-1"
    : viewportWidth < 1040
      ? (isSidebarCollapsed
        ? "!grid-cols-[44px_minmax(0,1fr)]"
        : "!grid-cols-[248px_minmax(0,1fr)]")
      : (isSidebarCollapsed
        ? (isInspectorCollapsed
          ? "!grid-cols-[44px_minmax(0,1fr)_44px]"
          : "!grid-cols-[44px_minmax(0,1fr)_var(--inspector-width)]")
        : (isInspectorCollapsed
          ? "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_44px]"
          : "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--inspector-width)]"));

  const isStackedDashboard = viewportWidth < 960;
  const isCompactDashboard = viewportWidth < 1040;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">

      <TopBar
        isConnected={isConnected}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        selectedTaskTitle={selectedTaskDisplayTitle ?? taskDetail?.task.title ?? null}
        taskScopeEnabled={taskScopeEnabled}
        observabilityStats={observabilityStats ? { checks: observabilityStats.checks, violations: observabilityStats.violations, passes: observabilityStats.passes } : null}
        zoom={zoom}
        onZoomChange={setZoom}
        onTaskScopeToggle={setTaskScopeEnabled}
        onSearchQueryChange={setSearchQuery}
        onSelectSearchTask={(taskId) => {
          setSearchQuery("");
          dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
          dispatch({ type: "SELECT_EVENT", eventId: null });
          dispatch({ type: "SELECT_TASK", taskId });
        }}
        onSelectSearchEvent={(taskId, eventId) => {
          setSearchQuery("");
          dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
          dispatch({ type: "SELECT_TASK", taskId });
          dispatch({ type: "SELECT_EVENT", eventId });
        }}
        onSelectSearchBookmark={(bookmark) => {
          setSearchQuery("");
          const target = bookmarks.find((item) => item.id === bookmark.bookmarkId);
          if (target) {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_TASK", taskId: target.taskId });
            dispatch({ type: "SELECT_EVENT", eventId: target.eventId ?? null });
            return;
          }
          if (bookmark.eventId) {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_TASK", taskId: bookmark.taskId });
            dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId });
          } else {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_EVENT", eventId: null });
            dispatch({ type: "SELECT_TASK", taskId: bookmark.taskId });
          }
        }}
        onRefresh={() => void refreshOverview()}
      />

      <main
        className={cn(
          "dashboard-shell grid flex-1 min-h-0 gap-3 p-2.5 transition-[grid-template-columns] duration-200",
          dashboardColumns,
          isStackedDashboard ? "auto-rows-max overflow-y-auto" : "overflow-hidden",
          isSidebarCollapsed && "sidebar-collapsed",
          isInspectorCollapsed && "inspector-collapsed"
        )}
        style={dashboardStyle}
      >

        <div
          className={cn(
            "sidebar-slot relative flex min-h-0 min-w-0 flex-col overflow-hidden",
            isCompactDashboard && "min-h-[21rem]",
            isStackedDashboard && "order-2 overflow-visible"
          )}
        >
          <TaskList
            tasks={tasks}
            bookmarks={bookmarks}
            taskDisplayTitleCache={taskDisplayTitleCache}
            selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
            selectedTaskId={selectedTaskId}
            taskDetail={taskDetail}
            selectedTaskQuestionCount={questionGroups.length}
            selectedTaskTodoCount={todoGroups.length}
            deletingTaskId={deletingTaskId}
            deleteErrorTaskId={deleteErrorTaskId}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
            onSelectTask={(id) => dispatch({ type: "SELECT_TASK", taskId: id })}
            onSelectBookmark={(bookmark) => {
              dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
              dispatch({ type: "SELECT_TASK", taskId: bookmark.taskId });
              dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId ?? null });
            }}
            onDeleteBookmark={(bookmarkId) => {
              void handleDeleteBookmark(bookmarkId).catch((err) => {
                dispatch({
                  type: "SET_STATUS",
                  status: "error",
                  errorMessage: err instanceof Error ? err.message : "Failed to delete bookmark."
                });
              });
            }}
            onSaveTaskBookmark={() => {
              void handleCreateTaskBookmark().catch((err) => {
                dispatch({
                  type: "SET_STATUS",
                  status: "error",
                  errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
                });
              });
            }}
            onDeleteTask={(id) => void handleDeleteTask(id)}
            onRefresh={() => void refreshOverview()}
          />
          {!isSidebarCollapsed && (
            <div
              aria-label="Resize task sidebar"
              aria-orientation="vertical"
              className="sidebar-resizer absolute right-[-9px] top-2 bottom-2 z-10 w-3 cursor-col-resize before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--border)_74%,transparent)] before:transition-colors hover:before:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]"
              onPointerDown={onSidebarResizeStart}
              role="separator"
            />
          )}
        </div>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
            isCompactDashboard && "min-h-[22rem]",
            isStackedDashboard && "order-1 min-h-[28rem]"
          )}
        >
          {status === "error" && (
            <div className="error-banner flex-shrink-0 border-b border-[#fca5a5] bg-[var(--err-bg)] px-3.5 py-2 text-[0.82rem] text-[var(--err)]">
              <strong>Monitor unavailable</strong>
              <p className="m-0">{errorMessage}</p>
            </div>
          )}

          <Timeline
            zoom={zoom}
            onZoomChange={setZoom}
            backgroundTasks={tasks.filter((t) => t.taskKind === "background" && t.parentTaskId === selectedTaskId)}
            timeline={taskTimeline}
            taskTitle={selectedTaskDisplayTitle}
            taskWorkspacePath={taskDetail?.task.workspacePath}
            taskStatus={taskDetail?.task.status}
            taskUpdatedAt={taskDetail?.task.updatedAt}
            taskUsesDerivedTitle={selectedTaskUsesDerivedTitle}
            isEditingTaskTitle={isEditingTaskTitle}
            taskTitleDraft={taskTitleDraft}
            taskTitleError={taskTitleError}
            isSavingTaskTitle={isSavingTaskTitle}
            isUpdatingTaskStatus={isUpdatingTaskStatus}
            selectedEventId={selectedEventId}
            selectedConnectorKey={selectedConnectorKey}
            selectedRuleId={selectedRuleId}
            selectedTag={selectedTag}
            showRuleGapsOnly={showRuleGapsOnly}
            nowMs={nowMs}
            observabilityStats={observabilityStats}
            onSelectEvent={(id) => {
              dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
              dispatch({ type: "SELECT_EVENT", eventId: id });
            }}
            onSelectConnector={(key) => {
              dispatch({ type: "SELECT_CONNECTOR", connectorKey: key });
              dispatch({ type: "SELECT_EVENT", eventId: null });
            }}
            onStartEditTitle={() => {
              dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "" });
              dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
              dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: true });
            }}
            onCancelEditTitle={() => {
              dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "" });
              dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
              dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
            }}
            onSubmitTitle={(e) => void handleTaskTitleSubmit(e, taskTitleDraft)}
            onTitleDraftChange={(val) => dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: val })}
            onClearFilters={() => {
              dispatch({ type: "SELECT_RULE", ruleId: null });
              dispatch({ type: "SELECT_TAG", tag: null });
              dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
            }}
            onToggleRuleGap={(show) => dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show })}
            onClearRuleId={() => dispatch({ type: "SELECT_RULE", ruleId: null })}
            onClearTag={() => dispatch({ type: "SELECT_TAG", tag: null })}
            onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}
          />
        </section>

        <div className={cn("relative flex min-h-0 min-w-0 flex-col", isStackedDashboard && "order-3")}>
          {!isInspectorCollapsed && !isStackedDashboard && (
            <div
              aria-label="Resize inspector panel"
              aria-orientation="vertical"
              className="inspector-resizer absolute left-[-9px] top-2 bottom-2 z-10 w-3 cursor-col-resize before:absolute before:left-[5px] before:top-0 before:bottom-0 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--border)_74%,transparent)] before:transition-colors hover:before:bg-[color-mix(in_srgb,var(--accent)_75%,transparent)]"
              onPointerDown={onInspectorResizeStart}
              role="separator"
            />
          )}
          <EventInspector
            taskDetail={taskDetail}
            selectedEvent={selectedEvent}
            selectedConnector={selectedConnector}
            selectedEventDisplayTitle={selectedEventDisplayTitle}
            selectedTaskBookmark={selectedTaskBookmark}
            selectedEventBookmark={selectedEventBookmark}
            selectedTag={selectedTag}
            selectedRuleId={selectedRuleId}
            taskModelSummary={modelSummary}
            isCollapsed={isInspectorCollapsed}
            onToggleCollapse={() => setIsInspectorCollapsed((v) => !v)}
            onCreateTaskBookmark={() => {
              void handleCreateTaskBookmark().catch((err) => {
                dispatch({
                  type: "SET_STATUS",
                  status: "error",
                  errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
                });
              });
            }}
            onCreateEventBookmark={() => {
              if (!selectedEvent) return;
              void handleCreateEventBookmark(selectedEvent.id, selectedEvent.title).catch((err) => {
                dispatch({
                  type: "SET_STATUS",
                  status: "error",
                  errorMessage: err instanceof Error ? err.message : "Failed to save event bookmark."
                });
              });
            }}
            onSelectTag={(tag) => dispatch({ type: "SELECT_TAG", tag })}
            onSelectRule={(ruleId) => {
              dispatch({ type: "SET_SHOW_RULE_GAPS_ONLY", show: false });
              dispatch({ type: "SELECT_RULE", ruleId });
            }}
          />
        </div>

      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported App — wraps Dashboard in Provider
// ---------------------------------------------------------------------------

export function App(): React.JSX.Element {
  return (
    <MonitorProvider>
      <Dashboard />
    </MonitorProvider>
  );
}
