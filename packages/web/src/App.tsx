import type React from "react";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useUrlSearchParam } from "./shared/lib/urlState.js";
import { refreshRealtimeMonitorData, buildQuestionGroups, buildTodoGroups } from "@monitor/web-core";
import type { BookmarkRecord, BookmarkSearchHit } from "@monitor/web-core";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { NavigationSidebar } from "./components/NavigationSidebar.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
const ApprovalQueuePanel = lazy(() => import("./components/ApprovalQueuePanel.js").then((m) => ({ default: m.ApprovalQueuePanel })));
const InspectorContainer = lazy(() => import("./components/InspectorContainer.js").then((m) => ({ default: m.InspectorContainer })));
const TaskWorkspacePage = lazy(() => import("./pages/TaskWorkspacePage.js").then((m) => ({ default: m.TaskWorkspacePage })));
import { MonitorProvider, useMonitorStore } from "@monitor/web-store";
import { useWebSocket } from "@monitor/web-store";
import { useSearch } from "@monitor/web-store";
import { useTheme } from "./lib/useTheme.js";
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";
const INSPECTOR_WIDTH = 360;
const DASHBOARD_STACKED_BREAKPOINT = 1024;
import { KnowledgeBaseContent } from "./components/knowledge/KnowledgeBaseContent.js";

function Dashboard({ view = "timeline", workspaceTaskId, onOpenTaskWorkspace, onSelectTaskRoute }: {
    readonly view?: "timeline" | "knowledge" | "workspace";
    readonly workspaceTaskId?: string;
    readonly onOpenTaskWorkspace: (taskId: string) => void;
    readonly onSelectTaskRoute: (taskId: string | null) => void;
}): React.JSX.Element {
    const { state, dispatch, refreshOverview, refreshTaskDetail, refreshBookmarksOnly, handleDeleteTask, handleDeleteBookmark } = useMonitorStore();
    const { bookmarks, tasks, selectedTaskId, taskDetail, isConnected, taskDisplayTitleCache, deletingTaskId, deleteErrorTaskId } = state;
    const { isConnected: wsConnected } = useWebSocket((message) => {
        void refreshRealtimeMonitorData({
            message,
            selectedTaskId,
            dispatch,
            refreshOverview,
            refreshTaskDetail,
            refreshBookmarksOnly
        });
    });
    useEffect(() => {
        dispatch({ type: "SET_CONNECTED", isConnected: wsConnected });
    }, [dispatch, wsConnected]);
    const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, isSearching, taskScopeEnabled, setTaskScopeEnabled } = useSearch(selectedTaskId ?? undefined);
    const [sidebarView, setSidebarView] = useState<"tasks" | "saved">("tasks");
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const isInspectorOpen = Boolean(selectedTaskId);
    const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isStackedDashboard = viewportWidth < DASHBOARD_STACKED_BREAKPOINT;
    useEffect(() => {
        if (!isInspectorOpen)
            setIsInspectorCollapsed(false);
    }, [isInspectorOpen]);
    useEffect(() => {
        const handleResize = (): void => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    useEffect(() => {
        if (!isStackedDashboard) {
            setIsSidebarOpen(false);
        }
    }, [isStackedDashboard]);
    useEffect(() => {
        if (isStackedDashboard && isInspectorCollapsed) {
            setIsInspectorCollapsed(false);
        }
    }, [isInspectorCollapsed, isStackedDashboard]);
    const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);
    const [zoom, setZoom] = useState<number>(() => {
        try {
            const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
            if (!raw)
                return ZOOM_DEFAULT;
            const parsed = Number.parseFloat(raw);
            if (!Number.isFinite(parsed))
                return ZOOM_DEFAULT;
            return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
        } catch {
            return ZOOM_DEFAULT;
        }
    });
    useEffect(() => {
        try { window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom)); } catch { /* storage unavailable */ }
    }, [zoom]);
    const selectedTaskDisplayTitle = useMemo(() => taskDetail?.task ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title) : null, [taskDetail, taskDisplayTitleCache]);
    const selectedTaskUsesDerivedTitle = Boolean(taskDetail?.task
        && selectedTaskDisplayTitle
        && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim());
    const selectDashboardTask = useCallback((taskId: string | null): void => {
        onSelectTaskRoute(taskId);
        dispatch({ type: "SELECT_TASK", taskId });
    }, [dispatch, onSelectTaskRoute]);
    const handleSidebarViewChange = useCallback((view: "tasks" | "saved"): void => {
        setSidebarView(view);
        if (isStackedDashboard) {
            setIsSidebarOpen(false);
        }
    }, [isStackedDashboard]);
    const handleSelectDashboardTask = useCallback((taskId: string): void => {
        if (isStackedDashboard) {
            setIsSidebarOpen(false);
        }
        selectDashboardTask(taskId);
    }, [isStackedDashboard, selectDashboardTask]);
    const selectedTaskBookmark = bookmarks.find((b) => b.taskId === (selectedTaskId ?? "") && !b.eventId) ?? null;
    const taskTimeline = taskDetail?.timeline ?? [];
    const questionCount = useMemo(() => buildQuestionGroups(taskTimeline).length, [taskTimeline]);
    const todoCount = useMemo(() => buildTodoGroups(taskTimeline).length, [taskTimeline]);
    const handleSelectBookmark = useCallback((bookmark: BookmarkRecord): void => {
        if (isStackedDashboard) {
            setIsSidebarOpen(false);
        }
        dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
        selectDashboardTask(bookmark.taskId);
        dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId ?? null });
    }, [dispatch, isStackedDashboard, selectDashboardTask]);
    const handleDeleteBookmarkWithError = useCallback((bookmarkId: string): void => {
        void handleDeleteBookmark(bookmarkId).catch((err) => {
            dispatch({
                type: "SET_STATUS",
                status: "error",
                errorMessage: err instanceof Error ? err.message : "Failed to delete bookmark."
            });
        });
    }, [dispatch, handleDeleteBookmark]);
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
        }
        else {
            dispatch({ type: "SELECT_EVENT", eventId: null });
            selectDashboardTask(bookmark.taskId);
        }
    }, [bookmarks, dispatch, selectDashboardTask, setSearchQuery]);
    return (<div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">

      <TopBar isConnected={isConnected} {...(isStackedDashboard ? {
            isNavigationOpen: isSidebarOpen,
            onToggleNavigation: () => setIsSidebarOpen((value) => !value)
        } : {})} pendingApprovalCount={state.overview?.observability?.tasksAwaitingApproval ?? 0} blockedTaskCount={state.overview?.observability?.tasksBlockedByRule ?? 0} onOpenApprovalQueue={() => setIsApprovalQueueOpen(true)} searchQuery={searchQuery} searchResults={searchResults} isSearching={isSearching} selectedTaskTitle={selectedTaskDisplayTitle ?? taskDetail?.task.title ?? null} taskScopeEnabled={taskScopeEnabled} onTaskScopeToggle={setTaskScopeEnabled} onSearchQueryChange={setSearchQuery} onSelectSearchTask={handleSelectSearchTask} onSelectSearchEvent={handleSelectSearchEvent} onSelectSearchBookmark={handleSelectSearchBookmark} onRefresh={() => void refreshOverview()}/>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {isStackedDashboard ? (<>
            {isSidebarOpen && (<button aria-label="Close navigation" className="absolute inset-0 z-20 bg-[color-mix(in_srgb,var(--text-1)_18%,transparent)] backdrop-blur-[1px]" onClick={() => setIsSidebarOpen(false)} type="button"/>)}

            <div className={cn("absolute inset-y-0 left-0 z-30 transition-transform duration-200 ease-out", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
              <NavigationSidebar
                className="w-[min(18rem,calc(100vw-1rem))] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
                isConnected={isConnected}
                activeView={sidebarView}
                onNavigate={() => setIsSidebarOpen(false)}
                onChangeView={handleSidebarViewChange}
                tasks={tasks}
                bookmarks={bookmarks}
                taskDisplayTitleCache={taskDisplayTitleCache}
                selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
                selectedTaskId={selectedTaskId}
                taskDetail={taskDetail}
                selectedTaskQuestionCount={questionCount}
                selectedTaskTodoCount={todoCount}
                deletingTaskId={deletingTaskId}
                deleteErrorTaskId={deleteErrorTaskId}
                onSelectTask={handleSelectDashboardTask}
                onSelectBookmark={handleSelectBookmark}
                onDeleteBookmark={handleDeleteBookmarkWithError}
                onDeleteTask={(id) => void handleDeleteTask(id)}
              />
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 p-2.5">
              {view === "knowledge" ? (
                <KnowledgeBaseContent onSelectTask={handleSelectDashboardTask} />
              ) : view === "workspace" && workspaceTaskId ? (
                <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]"/>}>
                  <TaskWorkspacePage taskId={workspaceTaskId} embedded />
                </Suspense>
              ) : (
                <TimelineContainer isCompactDashboard={false} isStackedDashboard={true} zoom={zoom} selectedTaskDisplayTitle={selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle} onZoomChange={setZoom} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
              )}

              {view === "timeline" && isInspectorOpen && (<Suspense fallback={<div className="min-h-[20rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"/>}>
                  <InspectorContainer isStackedDashboard={true} isInspectorCollapsed={false} selectedTaskDisplayTitle={selectedTaskDisplayTitle} onToggleCollapse={() => { }} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
                </Suspense>)}
            </div>
          </>) : (<>
            <NavigationSidebar
              isConnected={isConnected}
              activeView={sidebarView}
              onChangeView={handleSidebarViewChange}
              tasks={tasks}
              bookmarks={bookmarks}
              taskDisplayTitleCache={taskDisplayTitleCache}
              selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
              selectedTaskId={selectedTaskId}
              taskDetail={taskDetail}
              selectedTaskQuestionCount={questionCount}
              selectedTaskTodoCount={todoCount}
              deletingTaskId={deletingTaskId}
              deleteErrorTaskId={deleteErrorTaskId}
              onSelectTask={handleSelectDashboardTask}
              onSelectBookmark={handleSelectBookmark}
              onDeleteBookmark={handleDeleteBookmarkWithError}
              onDeleteTask={(id) => void handleDeleteTask(id)}
            />

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2.5 transition-[padding-right] duration-200" style={{ paddingRight: (view === "timeline" && isInspectorOpen) ? `${(isInspectorCollapsed ? 44 : INSPECTOR_WIDTH) + 10}px` : undefined }}>
              {view === "knowledge" ? (
                <KnowledgeBaseContent onSelectTask={handleSelectDashboardTask} />
              ) : view === "workspace" && workspaceTaskId ? (
                <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]"/>}>
                  <TaskWorkspacePage taskId={workspaceTaskId} embedded />
                </Suspense>
              ) : (
                <TimelineContainer isCompactDashboard={false} isStackedDashboard={false} zoom={zoom} selectedTaskDisplayTitle={selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle} onZoomChange={setZoom} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
              )}
            </div>

            {view === "timeline" && (
                <div className={cn("absolute bottom-0 right-0 top-0 z-10 flex flex-col transition-[transform,width] duration-200 ease-out", isInspectorOpen ? "translate-x-0" : "translate-x-full")} style={{ width: isInspectorCollapsed ? 44 : INSPECTOR_WIDTH }}>
                  {isInspectorCollapsed ? (<div className="flex h-full flex-col items-center border-l border-[var(--border)] bg-[var(--surface)] pt-3">
                      <button aria-label="Expand inspector" className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={() => setIsInspectorCollapsed(false)} type="button">
                        <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                          <path d="M15 18l-6-6 6-6"/>
                        </svg>
                      </button>
                    </div>) : (<Suspense fallback={<div className="h-full border-l border-[var(--border)] bg-[var(--surface)]"/>}>
                        <InspectorContainer isStackedDashboard={false} isInspectorCollapsed={false} selectedTaskDisplayTitle={selectedTaskDisplayTitle} onToggleCollapse={() => setIsInspectorCollapsed(true)} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
                      </Suspense>)}
                </div>
            )}
          </>)}
      </div>

      {isApprovalQueueOpen && (<Suspense fallback={null}>
          <ApprovalQueuePanel tasks={tasks} onClose={() => setIsApprovalQueueOpen(false)} onRefresh={refreshOverview} onSelectTask={(taskId) => {
                dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
                dispatch({ type: "SELECT_EVENT", eventId: null });
                selectDashboardTask(taskId);
                setIsApprovalQueueOpen(false);
            }}/>
        </Suspense>)}
    </div>);
}
function DashboardRoute({ view = "timeline" }: { readonly view?: "timeline" | "knowledge" }): React.JSX.Element {
    const { state, dispatch } = useMonitorStore();
    const [routeTaskId, setRouteTaskId] = useUrlSearchParam("task");
    const navigate = useNavigate();
    // One-way: URL is the source of truth, mirror it into the store on change.
    // No back-write effect — if the user strips ?task= we honor it by clearing
    // the selection instead of restoring the URL from the store.
    useLayoutEffect(() => {
        if (routeTaskId === state.selectedTaskId)
            return;
        dispatch({ type: "SELECT_TASK", taskId: routeTaskId });
    }, [dispatch, routeTaskId, state.selectedTaskId]);
    // URL-driven auto-select: once tasks are ready and no task is in the URL,
    // promote the first task into ?task=. The URL change round-trips through
    // the mirror above, so the store ends up selecting the same task without
    // the store ever having to write the URL.
    useEffect(() => {
        if (routeTaskId !== null) return;
        if (state.status !== "ready") return;
        const firstTask = state.tasks[0];
        if (!firstTask) return;
        setRouteTaskId(firstTask.id);
    }, [routeTaskId, setRouteTaskId, state.status, state.tasks]);
    return (<Dashboard view={view} onSelectTaskRoute={setRouteTaskId} onOpenTaskWorkspace={(taskId) => { void navigate(`/tasks/${encodeURIComponent(taskId)}?tab=overview`); }}/>);
}
function TaskWorkspaceRoute(): React.JSX.Element {
    const { taskId } = useParams<{
        readonly taskId: string;
    }>();
    const navigate = useNavigate();
    if (!taskId)
        return <Navigate replace to="/"/>;
    return (<Dashboard
        view="workspace"
        workspaceTaskId={taskId}
        onOpenTaskWorkspace={(newTaskId) => { void navigate(`/tasks/${encodeURIComponent(newTaskId)}`); }}
        onSelectTaskRoute={(tid) => { if (tid) void navigate(`/tasks/${encodeURIComponent(tid)}`); else void navigate("/"); }}
    />);
}
function AppRoutes(): React.JSX.Element {
    return (<Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<DashboardRoute />}/>
        <Route path="/tasks/:taskId" element={<TaskWorkspaceRoute />}/>
        <Route path="/knowledge" element={<DashboardRoute view="knowledge" />}/>
        <Route path="*" element={<Navigate replace to="/"/>}/>
      </Routes>
    </Suspense>);
}
export function App(): React.JSX.Element {
    useTheme();
    return (<MonitorProvider>
      <AppRoutes />
    </MonitorProvider>);
}
