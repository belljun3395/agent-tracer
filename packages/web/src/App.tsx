/**
 * 대시보드 루트 컴포넌트.
 * 레이아웃 조합만 담당. 데이터 페칭·소켓·검색은 store hooks에 위임.
 */

import type React from "react";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { refreshRealtimeMonitorData } from "./lib/realtime.js";
import type { BookmarkSearchHit } from "./types.js";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { WorkflowLibraryPanel } from "./components/WorkflowLibraryPanel.js";
import { ApprovalQueuePanel } from "./components/ApprovalQueuePanel.js";
import { SidebarContainer } from "./components/SidebarContainer.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
import { InspectorContainer } from "./components/InspectorContainer.js";

// Code-split page routes
const TaskWorkspacePage = lazy(() =>
  import("./pages/TaskWorkspacePage.js").then((m) => ({ default: m.TaskWorkspacePage }))
);
import { MonitorProvider, useMonitorStore } from "./store/useMonitorStore.js";
import { useWebSocket } from "./store/useWebSocket.js";
import { useSearch } from "./store/useSearch.js";
import { useResizable } from "./hooks/useResizable.js";
import { useTheme } from "./lib/useTheme.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";

// ---------------------------------------------------------------------------
// Inner dashboard (consumes context)
// ---------------------------------------------------------------------------

function Dashboard({
  onOpenTaskWorkspace,
  onSelectTaskRoute
}: {
  readonly onOpenTaskWorkspace: (taskId: string) => void;
  readonly onSelectTaskRoute: (taskId: string | null) => void;
}): React.JSX.Element {
  const {
    state,
    dispatch,
    refreshOverview,
    refreshTaskDetail,
    refreshBookmarksOnly
  } = useMonitorStore();

  const {
    bookmarks,
    tasks,
    selectedTaskId,
    taskDetail,
    isConnected,
    taskDisplayTitleCache
  } = state;

  // WebSocket: message 수신 시 overview + taskDetail 새로고침
  const { isConnected: wsConnected } = useWebSocket((message) => {
    void refreshRealtimeMonitorData({
      message,
      selectedTaskId,
      refreshOverview,
      refreshTaskDetail,
      refreshBookmarksOnly
    });
  });

  useEffect(() => {
    dispatch({ type: "SET_CONNECTED", isConnected: wsConnected });
  }, [dispatch, wsConnected]);

  // Search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    isSearching,
    taskScopeEnabled,
    setTaskScopeEnabled
  } = useSearch(selectedTaskId ?? undefined);

  // Resize state via hook
  const {
    sidebarWidth,
    inspectorWidth,
    isSidebarCollapsed,
    isInspectorCollapsed,
    viewportWidth,
    setIsSidebarCollapsed,
    setIsInspectorCollapsed,
    onSidebarResizeStart,
    onInspectorResizeStart
  } = useResizable();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);

  const [zoom, setZoom] = useState<number>(() => {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (!raw) return ZOOM_DEFAULT;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return ZOOM_DEFAULT;
    return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
  });

  useEffect(() => {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  }, [zoom]);

  const selectedTaskDisplayTitle = useMemo(
    () => taskDetail?.task ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title) : null,
    [taskDetail, taskDisplayTitleCache]
  );

  const selectedTaskUsesDerivedTitle = Boolean(
    taskDetail?.task
    && selectedTaskDisplayTitle
    && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim()
  );


  // observabilityStats, exploredFiles, compactInsight are computed inside
  // TimelineContainer — no longer needed at Dashboard level after TopBar simplification.
  const selectDashboardTask = useCallback((taskId: string | null): void => {
    onSelectTaskRoute(taskId);
    dispatch({ type: "SELECT_TASK", taskId });
  }, [dispatch, onSelectTaskRoute]);

  const handleSelectSearchTask = useCallback((taskId: string): void => {
    setSearchQuery("");
    dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
    dispatch({ type: "SELECT_EVENT", eventId: null });
    selectDashboardTask(taskId);
  }, [dispatch, selectDashboardTask, setSearchQuery]);

  const handleSelectSearchEvent = useCallback((taskId: string, eventId: string): void => {
    setSearchQuery("");
    dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
    selectDashboardTask(taskId);
    dispatch({ type: "SELECT_EVENT", eventId });
  }, [dispatch, selectDashboardTask, setSearchQuery]);

  const handleSelectSearchBookmark = useCallback((bookmark: BookmarkSearchHit): void => {
    setSearchQuery("");
    const target = bookmarks.find((item) => item.id === bookmark.bookmarkId);
    if (target) {
      dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
      selectDashboardTask(target.taskId);
      dispatch({ type: "SELECT_EVENT", eventId: target.eventId ?? null });
      return;
    }
    dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
    if (bookmark.eventId) {
      selectDashboardTask(bookmark.taskId);
      dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId });
    } else {
      dispatch({ type: "SELECT_EVENT", eventId: null });
      selectDashboardTask(bookmark.taskId);
    }
  }, [bookmarks, dispatch, selectDashboardTask, setSearchQuery]);


  // Layout
  const dashboardStyle = useMemo(
    () => ({
      "--sidebar-width": `${sidebarWidth}px`,
      "--inspector-width": `${inspectorWidth}px`
    }) as React.CSSProperties,
    [sidebarWidth, inspectorWidth]
  );

  const isStackedDashboard = viewportWidth < 1024;
  const isCompactDashboard = viewportWidth < 1280;

  const dashboardColumns = viewportWidth < 1024
    ? "!grid-cols-1"
    : viewportWidth < 1280
      ? (isSidebarCollapsed ? "!grid-cols-[44px_minmax(0,1fr)]" : "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)]")
      : (isSidebarCollapsed
        ? (isInspectorCollapsed ? "!grid-cols-[44px_minmax(0,1fr)_44px]" : "!grid-cols-[44px_minmax(0,1fr)_var(--inspector-width)]")
        : (isInspectorCollapsed ? "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_44px]" : "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--inspector-width)]"));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      <TopBar
        isConnected={isConnected}
        pendingApprovalCount={state.overview?.observability?.tasksAwaitingApproval ?? 0}
        blockedTaskCount={state.overview?.observability?.tasksBlockedByRule ?? 0}
        onOpenApprovalQueue={() => setIsApprovalQueueOpen(true)}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        selectedTaskTitle={selectedTaskDisplayTitle ?? taskDetail?.task.title ?? null}
        taskScopeEnabled={taskScopeEnabled}
        onTaskScopeToggle={setTaskScopeEnabled}
        onSearchQueryChange={setSearchQuery}
        onSelectSearchTask={handleSelectSearchTask}
        onSelectSearchEvent={handleSelectSearchEvent}
        onSelectSearchBookmark={handleSelectSearchBookmark}
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
        <SidebarContainer
          isCompactDashboard={isCompactDashboard}
          isStackedDashboard={isStackedDashboard}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
          onSidebarResizeStart={onSidebarResizeStart}
          onSelectTask={selectDashboardTask}
          onOpenLibrary={() => setIsLibraryOpen(true)}
        />

        <TimelineContainer
          isCompactDashboard={isCompactDashboard}
          isStackedDashboard={isStackedDashboard}
          zoom={zoom}
          selectedTaskDisplayTitle={selectedTaskDisplayTitle}
          selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle}
          onZoomChange={setZoom}
          onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}
        />

        <InspectorContainer
          isStackedDashboard={isStackedDashboard}
          isInspectorCollapsed={isInspectorCollapsed}
          selectedTaskDisplayTitle={selectedTaskDisplayTitle}
          onToggleCollapse={() => setIsInspectorCollapsed((v) => !v)}
          onInspectorResizeStart={onInspectorResizeStart}
          onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}
        />
      </main>

      {isLibraryOpen && (
        <WorkflowLibraryPanel
          onSelectTask={(taskId) => {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_EVENT", eventId: null });
            selectDashboardTask(taskId);
          }}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {isApprovalQueueOpen && (
        <ApprovalQueuePanel
          tasks={tasks}
          onClose={() => setIsApprovalQueueOpen(false)}
          onRefresh={refreshOverview}
          onSelectTask={(taskId) => {
            dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
            dispatch({ type: "SELECT_EVENT", eventId: null });
            selectDashboardTask(taskId);
            setIsApprovalQueueOpen(false);
          }}
        />
      )}

    </div>
  );
}

function DashboardRoute(): React.JSX.Element {
  const { state, dispatch } = useMonitorStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeTaskId = searchParams.get("task");

  useLayoutEffect(() => {
    if (!routeTaskId || routeTaskId === state.selectedTaskId) return;
    dispatch({ type: "SELECT_TASK", taskId: routeTaskId });
  }, [dispatch, routeTaskId, state.selectedTaskId]);

  useEffect(() => {
    const currentTaskId = searchParams.get("task");
    if (!state.selectedTaskId) return;
    if (currentTaskId === state.selectedTaskId) return;
    if (currentTaskId && currentTaskId !== state.selectedTaskId) return;
    const next = new URLSearchParams(searchParams);
    next.set("task", state.selectedTaskId);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, state.selectedTaskId]);

  return (
    <Dashboard
      onSelectTaskRoute={(taskId) => {
        const next = new URLSearchParams(searchParams);
        if (taskId) { next.set("task", taskId); } else { next.delete("task"); }
        setSearchParams(next, { replace: true });
      }}
      onOpenTaskWorkspace={(taskId) => { void navigate(`/tasks/${encodeURIComponent(taskId)}?tab=overview`); }}
    />
  );
}

function TaskWorkspaceRoute(): React.JSX.Element {
  const { taskId } = useParams<{ readonly taskId: string }>();
  if (!taskId) return <Navigate replace to="/" />;
  return <TaskWorkspacePage taskId={taskId} />;
}

function AppRoutes(): React.JSX.Element {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/tasks/:taskId" element={<TaskWorkspaceRoute />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Suspense>
  );
}

export function App(): React.JSX.Element {
  useTheme();
  return (
    <MonitorProvider>
      <AppRoutes />
    </MonitorProvider>
  );
}
