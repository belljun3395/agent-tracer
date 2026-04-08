/**
 * 대시보드 루트 컴포넌트.
 * 레이아웃 조합만 담당. 데이터 페칭·소켓·검색은 store hooks에 위임.
 */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { createMonitoredTask, fetchDefaultWorkspace } from "./api.js";
import { refreshRealtimeMonitorData } from "./lib/realtime.js";
import type { BookmarkSearchHit } from "./types.js";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { WorkflowLibraryPanel } from "./components/WorkflowLibraryPanel.js";
import { ApprovalQueuePanel } from "./components/ApprovalQueuePanel.js";
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
import type { CliType } from "./types/chat.js";
import { useTheme } from "./lib/useTheme.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";
const DEFAULT_OPENCODE_MODEL = "openai/gpt-5.4";
const PROMPT_RUNNER_WORKDIR_STORAGE_KEY = "agent-tracer.prompt-runner-workdir";

export function isOpenCodeBridgeComplexPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return (
    /서브\s*에이전트|subagent|sub-agent|병렬|parallel|latest news|최근 소식|research|investigate|look up|찾아줘|10개|top 10/.test(normalized)
  );
}

function resolvePromptRunnerWorkdir(
  tasks: readonly { id: string; workspacePath?: string }[],
  selectedTaskId: string | null
): string {
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId)
    : undefined;
  if (selectedTask?.workspacePath) {
    return selectedTask.workspacePath;
  }

  const stored = window.localStorage.getItem(PROMPT_RUNNER_WORKDIR_STORAGE_KEY)?.trim();
  if (stored) {
    return stored;
  }

  const firstTaskWithWorkdir = tasks.find((task) => task.workspacePath)?.workspacePath;
  return firstTaskWithWorkdir ?? "";
}

// ---------------------------------------------------------------------------
// Inner dashboard (consumes context)
// ---------------------------------------------------------------------------

function Dashboard({
  onOpenTaskWorkspace,
  onSelectTaskRoute,
  launchSession
}: {
  readonly onOpenTaskWorkspace: (taskId: string) => void;
  readonly onSelectTaskRoute: (taskId: string | null) => void;
  readonly launchSession: ReturnType<typeof useCliChat>["launchSession"];
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
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatCli, setNewChatCli] = useState<CliType>("claude");
  const [newChatWorkdir, setNewChatWorkdir] = useState("");
  const [newChatModel, setNewChatModel] = useState("");
  const [newChatPrompt, setNewChatPrompt] = useState("");
  const [newChatTaskId, setNewChatTaskId] = useState<string | null>(null);
  const [newChatCliSessionId, setNewChatCliSessionId] = useState<string | undefined>(undefined);
  const [newChatTitle, setNewChatTitle] = useState("Run Prompt");
  const isPromptBlockedForOpenCode = useMemo(
    () => newChatCli === "opencode" && isOpenCodeBridgeComplexPrompt(newChatPrompt),
    [newChatCli, newChatPrompt]
  );

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

  useEffect(() => {
    if (isNewChatModalOpen) return;
    const nextWorkdir = resolvePromptRunnerWorkdir(tasks, selectedTaskId);
    if (!nextWorkdir) return;
    setNewChatWorkdir(nextWorkdir);
  }, [isNewChatModalOpen, selectedTaskId, tasks]);

  useEffect(() => {
    const trimmed = newChatWorkdir.trim();
    if (!trimmed) return;
    window.localStorage.setItem(PROMPT_RUNNER_WORKDIR_STORAGE_KEY, trimmed);
  }, [newChatWorkdir]);

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

  const handleOpenNewChat = useCallback(async (): Promise<void> => {
    setNewChatTitle("Run New Task");
    setNewChatTaskId(null);
    setNewChatCliSessionId(undefined);
    let nextWorkdir = resolvePromptRunnerWorkdir(tasks, selectedTaskId);
    if (!nextWorkdir) {
      try {
        nextWorkdir = (await fetchDefaultWorkspace()).workspacePath;
      } catch {
        nextWorkdir = "";
      }
    }
    setNewChatWorkdir(nextWorkdir);
    setNewChatPrompt("");
    setIsNewChatModalOpen(true);
  }, [selectedTaskId, tasks]);

  const handleCreateChatSession = useCallback(async (): Promise<void> => {
    const prompt = newChatPrompt.trim();
    if (!newChatWorkdir.trim() || !prompt) return;
    const resolvedModel = newChatCli === "opencode"
      ? (newChatModel.trim() || DEFAULT_OPENCODE_MODEL)
      : newChatModel.trim();
    let resolvedTaskId = newChatTaskId;
    if (!resolvedTaskId) {
      const createdTask = await createMonitoredTask({
        title: prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt,
        workspacePath: newChatWorkdir.trim(),
        runtimeSource: newChatCli === "opencode" ? "opencode-bridge" : "claude-hook"
      });
      resolvedTaskId = createdTask.id;
      dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
      dispatch({ type: "SELECT_EVENT", eventId: null });
      selectDashboardTask(createdTask.id);
      void refreshOverview();
    }
    launchSession({
      cli: newChatCli,
      workdir: newChatWorkdir.trim(),
      ...(resolvedTaskId ? { taskId: resolvedTaskId } : {}),
      ...(newChatCliSessionId ? { cliSessionId: newChatCliSessionId } : {}),
      ...(resolvedModel ? { model: resolvedModel } : {})
    }, prompt);
    setNewChatPrompt("");
    setIsNewChatModalOpen(false);
  }, [dispatch, launchSession, newChatCli, newChatWorkdir, newChatPrompt, newChatTaskId, newChatCliSessionId, newChatModel, refreshOverview, selectDashboardTask]);

  const handleContinueTaskChat = useCallback((taskId: string, workspacePath?: string): void => {
    const resolvedWorkdir = workspacePath ?? tasks.find((task) => task.id === taskId)?.workspacePath ?? "";
    // Detect CLI type from the task's runtimeSource so we resume with the right adapter.
    const task = tasks.find((t) => t.id === taskId);
    const cli: CliType = task?.runtimeSource?.includes("opencode") ? "opencode" : "claude";

    // Use the runtimeSessionId from the already-loaded taskDetail so cli:resume is sent
    // instead of cli:start — this is what actually carries context across turns.
    const cliSessionId =
      taskDetail?.task.id === taskId ? taskDetail.runtimeSessionId : undefined;

    setNewChatTitle("Continue Task");
    setNewChatCli(cli);
    setNewChatWorkdir(resolvedWorkdir);
    setNewChatTaskId(taskId);
    setNewChatCliSessionId(cliSessionId);
    if (cli === "opencode" && !newChatModel.trim()) {
      setNewChatModel(DEFAULT_OPENCODE_MODEL);
    }
    setNewChatPrompt("");
    setIsNewChatModalOpen(true);
  }, [newChatModel, taskDetail, tasks]);

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
          onOpenNewChat={() => { void handleOpenNewChat(); }}
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

      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Prompt runner">
          <button
            aria-label="Close prompt runner"
            className="absolute inset-0"
            onClick={() => setIsNewChatModalOpen(false)}
            type="button"
          />
          <div
            className="relative mt-12 w-full max-w-xl overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <h2 className="text-[0.92rem] font-semibold text-[var(--text-1)]">{newChatTitle}</h2>
            </div>
            <div className="space-y-4 p-4">
              <label className="block">
                <span className="mb-1 block text-[0.74rem] font-semibold text-[var(--text-2)]">CLI</span>
                <select
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem]"
                  onChange={(event) => {
                    const nextCli: CliType = event.target.value === "opencode" ? "opencode" : "claude";
                    setNewChatCli(nextCli);
                    if (nextCli === "opencode" && !newChatModel.trim()) {
                      setNewChatModel(DEFAULT_OPENCODE_MODEL);
                    }
                  }}
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
              <label className="block">
                <span className="mb-1 block text-[0.74rem] font-semibold text-[var(--text-2)]">Prompt</span>
                <textarea
                  className="min-h-[120px] w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem] leading-6"
                  onChange={(event) => setNewChatPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      if (!newChatWorkdir.trim() || !newChatPrompt.trim()) return;
                      void handleCreateChatSession();
                    }
                  }}
                  placeholder="Describe the task you want to run."
                  value={newChatPrompt}
                />
                <span className="mt-1 block text-[0.7rem] text-[var(--text-3)]">
                  The main dashboard will stay visible while the task runs. Press Cmd/Ctrl + Enter to run.
                </span>
              </label>
              {newChatCli === "opencode" && (
                <label className="block">
                  <span className="mb-1 block text-[0.74rem] font-semibold text-[var(--text-2)]">Model</span>
                  <select
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[0.82rem]"
                    onChange={(event) => setNewChatModel(event.target.value)}
                    value={newChatModel}
                  >
                    <option value="">-- Select model --</option>
                    <optgroup label="OpenAI">
                      <option value="openai/gpt-5.3-codex-spark">openai/gpt-5.3-codex-spark</option>
                      <option value="openai/gpt-5.3-codex">openai/gpt-5.3-codex</option>
                      <option value="openai/gpt-5.4">openai/gpt-5.4</option>
                    </optgroup>
                    <optgroup label="GitHub Copilot">
                      <option value="github-copilot/claude-opus-4.6">github-copilot/claude-opus-4.6</option>
                      <option value="github-copilot/claude-sonnet-4.6">github-copilot/claude-sonnet-4.6</option>
                      <option value="github-copilot/gpt-5-mini">github-copilot/gpt-5-mini</option>
                    </optgroup>
                    <optgroup label="Anthropic">
                      <option value="anthropic/claude-opus-4-6">anthropic/claude-opus-4-6</option>
                      <option value="anthropic/claude-sonnet-4-6">anthropic/claude-sonnet-4-6</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="opencode/minimax-m2.5-free">opencode/minimax-m2.5-free</option>
                    </optgroup>
                  </select>
                  <span className="mt-0.5 block text-[0.68rem] text-[var(--text-3)]">
                    {`In headless mode, OpenCode defaults to ${DEFAULT_OPENCODE_MODEL} when no model is selected.`}
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.78rem] font-semibold"
                  onClick={() => setIsNewChatModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-1.5 text-[0.78rem] font-semibold text-[var(--accent)]"
                  disabled={!newChatWorkdir.trim() || !newChatPrompt.trim() || isPromptBlockedForOpenCode}
                  onClick={() => { void handleCreateChatSession(); }}
                  type="button"
                >
                  Run Prompt
                </button>
              </div>
              {isPromptBlockedForOpenCode && (
                <p className="m-0 text-[0.74rem] text-[var(--warn)]">
                  OpenCode Bridge is currently limited for complex research or subagent prompts. Use Claude Code here, or run OpenCode directly in its native environment.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardRoute({
  launchSession
}: {
  readonly launchSession: ReturnType<typeof useCliChat>["launchSession"];
}): React.JSX.Element {
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
      launchSession={launchSession}
      onSelectTaskRoute={(taskId) => {
        const next = new URLSearchParams(searchParams);
        if (taskId) { next.set("task", taskId); } else { next.delete("task"); }
        setSearchParams(next, { replace: true });
      }}
      onOpenTaskWorkspace={(taskId) => { void navigate(`/tasks/${encodeURIComponent(taskId)}?tab=overview`); }}
    />
  );
}

function TaskWorkspaceRoute({
  launchSession,
  interruptTask
}: {
  readonly launchSession: ReturnType<typeof useCliChat>["launchSession"];
  readonly interruptTask: ReturnType<typeof useCliChat>["interruptTask"];
}): React.JSX.Element {
  const { taskId } = useParams<{ readonly taskId: string }>();
  if (!taskId) return <Navigate replace to="/" />;
  return <TaskWorkspacePage taskId={taskId} launchSession={launchSession} interruptTask={interruptTask} />;
}

function ChatRoute(): React.JSX.Element {
  return <ChatPage />;
}

function AppRoutes(): React.JSX.Element {
  const { launchSession, interruptTask } = useCliChat();
  return (
    <Routes>
      <Route path="/" element={<DashboardRoute launchSession={launchSession} />} />
      <Route path="/tasks/:taskId" element={<TaskWorkspaceRoute launchSession={launchSession} interruptTask={interruptTask} />} />
      <Route path="/chat" element={<ChatRoute />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
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
