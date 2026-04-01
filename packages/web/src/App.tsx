/**
 * 대시보드 루트 컴포넌트.
 * 레이아웃 조합만 담당. 데이터 페칭·소켓·검색은 store hooks에 위임.
 */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  buildCompactInsight,
  buildObservabilityStats,
  collectExploredFiles
} from "./lib/insights.js";
import { refreshRealtimeMonitorData } from "./lib/realtime.js";
import type { BookmarkSearchHit } from "./types.js";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { WorkflowLibraryPanel } from "./components/WorkflowLibraryPanel.js";
import { SidebarContainer } from "./components/SidebarContainer.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
import { InspectorContainer } from "./components/InspectorContainer.js";
import { TaskWorkspacePage } from "./pages/TaskWorkspacePage.js";
import { ChatPage } from "./pages/ChatPage.js";
import { MonitorProvider, useMonitorStore } from "./store/useMonitorStore.js";
import { useWebSocket } from "./store/useWebSocket.js";
import { useSearch } from "./store/useSearch.js";
import { useResizable } from "./hooks/useResizable.js";
import { useCliChat } from "./hooks/useCliChat.js";
import { ChatWindow } from "./components/chat/index.js";
import type { CliType } from "./types/chat.js";

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
    overview,
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatCli, setNewChatCli] = useState<CliType>("claude");
  const [newChatWorkdir, setNewChatWorkdir] = useState("");

  const {
    state: cliChatState,
    activeSession,
    createSession,
    sendMessage,
    cancelSession,
    closeSession,
    setActiveSession
  } = useCliChat();

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

  // Derived values for TopBar + containers
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

  useEffect(() => {
    if (isNewChatModalOpen) return;
    if (!selectedTaskId) return;
    const selectedTask = tasks.find((task) => task.id === selectedTaskId);
    if (!selectedTask?.workspacePath) return;
    setNewChatWorkdir(selectedTask.workspacePath);
  }, [isNewChatModalOpen, selectedTaskId, tasks]);

  const exploredFiles = useMemo(() => collectExploredFiles(taskTimeline), [taskTimeline]);
  const compactInsight = useMemo(() => buildCompactInsight(taskTimeline), [taskTimeline]);
  const observabilityStats = useMemo(
    () => buildObservabilityStats(taskTimeline, exploredFiles.length, compactInsight.occurrences),
    [compactInsight.occurrences, exploredFiles.length, taskTimeline]
  );
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

  const handleOpenNewChat = useCallback((): void => {
    const selectedTask = tasks.find((task) => task.id === selectedTaskId);
    setNewChatWorkdir(selectedTask?.workspacePath ?? "");
    setIsNewChatModalOpen(true);
  }, [selectedTaskId, tasks]);

  const handleCreateChatSession = useCallback((): void => {
    if (!newChatWorkdir.trim()) return;
    const sessionId = createSession({
      cli: newChatCli,
      workdir: newChatWorkdir.trim(),
      ...(selectedTaskId ? { taskId: selectedTaskId } : {})
    });
    setActiveSession(sessionId);
    setIsNewChatModalOpen(false);
    setIsChatOpen(true);
  }, [createSession, newChatCli, newChatWorkdir, selectedTaskId, setActiveSession]);

  const handleContinueTaskChat = useCallback((taskId: string, workspacePath?: string): void => {
    const resolvedWorkdir = workspacePath ?? tasks.find((task) => task.id === taskId)?.workspacePath ?? "";
    if (!resolvedWorkdir) {
      setNewChatWorkdir("");
      setIsNewChatModalOpen(true);
      return;
    }
    const sessionId = createSession({
      cli: newChatCli,
      workdir: resolvedWorkdir,
      taskId
    });
    setActiveSession(sessionId);
    setIsChatOpen(true);
  }, [createSession, newChatCli, setActiveSession, tasks]);

  // Layout
  const dashboardStyle = useMemo(
    () => ({
      "--sidebar-width": `${sidebarWidth}px`,
      "--inspector-width": `${inspectorWidth}px`
    }) as React.CSSProperties,
    [sidebarWidth, inspectorWidth]
  );

  const isStackedDashboard = viewportWidth < 960;
  const isCompactDashboard = viewportWidth < 1040;

  const dashboardColumns = viewportWidth < 960
    ? "!grid-cols-1"
    : viewportWidth < 1040
      ? (isSidebarCollapsed ? "!grid-cols-[44px_minmax(0,1fr)]" : "!grid-cols-[248px_minmax(0,1fr)]")
      : (isSidebarCollapsed
        ? (isInspectorCollapsed ? "!grid-cols-[44px_minmax(0,1fr)_44px]" : "!grid-cols-[44px_minmax(0,1fr)_var(--inspector-width)]")
        : (isInspectorCollapsed ? "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_44px]" : "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--inspector-width)]"));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      <TopBar
        overview={overview}
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
        onSelectSearchTask={handleSelectSearchTask}
        onSelectSearchEvent={handleSelectSearchEvent}
        onSelectSearchBookmark={handleSelectSearchBookmark}
        onRefresh={() => void refreshOverview()}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenNewChat={handleOpenNewChat}
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
          onContinueChat={handleContinueTaskChat}
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

      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="New chat setup">
          <button
            aria-label="Close new chat modal"
            className="absolute inset-0"
            onClick={() => setIsNewChatModalOpen(false)}
            type="button"
          />
          <div
            className="relative mt-12 w-full max-w-xl overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <h2 className="text-[0.92rem] font-semibold text-[var(--text-1)]">New Chat</h2>
            </div>
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="mb-1 block text-[0.74rem] font-semibold text-[var(--text-2)]">CLI</span>
                <select
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem]"
                  onChange={(event) => setNewChatCli(event.target.value === "opencode" ? "opencode" : "claude")}
                  value={newChatCli}
                >
                  <option value="claude">Claude Code</option>
                  <option value="opencode">OpenCode</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[0.74rem] font-semibold text-[var(--text-2)]">Workdir</span>
                <input
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem]"
                  onChange={(event) => setNewChatWorkdir(event.target.value)}
                  placeholder="/absolute/path"
                  value={newChatWorkdir}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.78rem] font-semibold"
                  onClick={() => setIsNewChatModalOpen(false)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--accent)]"
                  disabled={!newChatWorkdir.trim()}
                  onClick={handleCreateChatSession}
                  type="button"
                >
                  시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="CLI chat">
          <button
            aria-label="Close chat modal"
            className="absolute inset-0"
            onClick={() => setIsChatOpen(false)}
            type="button"
          />
          <div
            className="relative mt-10 h-[min(82vh,860px)] w-full max-w-5xl px-2"
          >
            <ChatWindow
              isConnected={cliChatState.isConnected}
              onCancel={() => {
                if (!activeSession) return;
                cancelSession(activeSession.id);
              }}
              onClose={() => {
                if (!activeSession) {
                  setIsChatOpen(false);
                  return;
                }
                closeSession(activeSession.id);
                setIsChatOpen(false);
              }}
              onSendMessage={(message) => {
                if (!activeSession) return;
                sendMessage(activeSession.id, message);
              }}
              session={activeSession}
            />
          </div>
        </div>
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
      onOpenTaskWorkspace={(taskId) => navigate(`/tasks/${encodeURIComponent(taskId)}?tab=overview`)}
    />
  );
}

function TaskWorkspaceRoute(): React.JSX.Element {
  const { taskId } = useParams<{ readonly taskId: string }>();
  if (!taskId) return <Navigate replace to="/" />;
  return <TaskWorkspacePage taskId={taskId} />;
}

function ChatRoute(): React.JSX.Element {
  return <ChatPage />;
}

function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<DashboardRoute />} />
      <Route path="/tasks/:taskId" element={<TaskWorkspaceRoute />} />
      <Route path="/chat" element={<ChatRoute />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export function App(): React.JSX.Element {
  return (
    <MonitorProvider>
      <AppRoutes />
    </MonitorProvider>
  );
}
