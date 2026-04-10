import type React from "react";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { refreshRealtimeMonitorData } from "@monitor/web-core";
import type { BookmarkSearchHit } from "@monitor/web-core";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { SidebarContainer } from "./components/SidebarContainer.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
import { IconRail } from "./components/IconRail.js";
import type { RailPanel } from "./components/IconRail.js";
const WorkflowLibraryPanel = lazy(() => import("./components/WorkflowLibraryPanel.js").then((m) => ({ default: m.WorkflowLibraryPanel })));
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
const SIDEBAR_PINNED_KEY = "agent-tracer.sidebar-pinned";
function Dashboard({ onOpenTaskWorkspace, onSelectTaskRoute }: {
    readonly onOpenTaskWorkspace: (taskId: string) => void;
    readonly onSelectTaskRoute: (taskId: string | null) => void;
}): React.JSX.Element {
    const { state, dispatch, refreshOverview, refreshTaskDetail, refreshBookmarksOnly } = useMonitorStore();
    const { bookmarks, tasks, selectedTaskId, taskDetail, isConnected, taskDisplayTitleCache } = state;
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
    const [activePanel, setActivePanel] = useState<RailPanel>(null);
    const togglePanel = useCallback((panel: Exclude<RailPanel, null>): void => {
        setActivePanel((v) => (v === panel ? null : panel));
    }, []);
    const [sidebarPinned, setSidebarPinned] = useState<boolean>(() => {
        try {
            return window.localStorage.getItem(SIDEBAR_PINNED_KEY) === "true";
        }
        catch {
            return false;
        }
    });
    useEffect(() => {
        try {
            window.localStorage.setItem(SIDEBAR_PINNED_KEY, String(sidebarPinned));
        }
        catch {
            void 0;
        }
    }, [sidebarPinned]);
    const isInspectorOpen = Boolean(selectedTaskId);
    const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
    useEffect(() => {
        if (!isInspectorOpen)
            setIsInspectorCollapsed(false);
    }, [isInspectorOpen]);
    const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);
    const [zoom, setZoom] = useState<number>(() => {
        const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
        if (!raw)
            return ZOOM_DEFAULT;
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed))
            return ZOOM_DEFAULT;
        return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
    });
    useEffect(() => {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    }, [zoom]);
    const selectedTaskDisplayTitle = useMemo(() => taskDetail?.task ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title) : null, [taskDetail, taskDisplayTitleCache]);
    const selectedTaskUsesDerivedTitle = Boolean(taskDetail?.task
        && selectedTaskDisplayTitle
        && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim());
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
        }
        else {
            dispatch({ type: "SELECT_EVENT", eventId: null });
            selectDashboardTask(bookmark.taskId);
        }
    }, [bookmarks, dispatch, selectDashboardTask, setSearchQuery]);
    return (<div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
      
      <TopBar isConnected={isConnected} pendingApprovalCount={state.overview?.observability?.tasksAwaitingApproval ?? 0} blockedTaskCount={state.overview?.observability?.tasksBlockedByRule ?? 0} onOpenApprovalQueue={() => setIsApprovalQueueOpen(true)} searchQuery={searchQuery} searchResults={searchResults} isSearching={isSearching} selectedTaskTitle={selectedTaskDisplayTitle ?? taskDetail?.task.title ?? null} taskScopeEnabled={taskScopeEnabled} onTaskScopeToggle={setTaskScopeEnabled} onSearchQueryChange={setSearchQuery} onSelectSearchTask={handleSelectSearchTask} onSelectSearchEvent={handleSelectSearchEvent} onSelectSearchBookmark={handleSelectSearchBookmark} onRefresh={() => void refreshOverview()}/>

      
      <div className="relative flex flex-1 min-h-0 overflow-hidden">

        
        <IconRail activePanel={activePanel} isConnected={isConnected} onTogglePanel={togglePanel}/>

        
        {(activePanel === "tasks" || activePanel === "saved") && (sidebarPinned ? (<div className="flex h-full w-[280px] shrink-0 border-r border-[var(--border)]">
              <SidebarContainer onSelectTask={selectDashboardTask} onClose={() => setActivePanel(null)} initialView={activePanel === "saved" ? "saved" : "tasks"} isPinned onTogglePin={() => setSidebarPinned(false)}/>
            </div>) : (<>
              <div aria-hidden="true" className="absolute inset-0 z-20 bg-black/20" onClick={() => setActivePanel(null)}/>
              <div className="absolute bottom-0 left-12 top-0 z-30 flex animate-[slideInLeft_150ms_ease-out]">
                <SidebarContainer onSelectTask={selectDashboardTask} onClose={() => setActivePanel(null)} initialView={activePanel === "saved" ? "saved" : "tasks"} isPinned={false} onTogglePin={() => setSidebarPinned(true)}/>
              </div>
            </>))}

        
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2.5 transition-[padding-right] duration-200" style={{ paddingRight: isInspectorOpen ? `${(isInspectorCollapsed ? 44 : INSPECTOR_WIDTH) + 10}px` : undefined }}>
          <TimelineContainer isCompactDashboard={false} isStackedDashboard={false} zoom={zoom} selectedTaskDisplayTitle={selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle} onZoomChange={setZoom} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
        </div>

        
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
      </div>

      
      {activePanel === "library" && (<Suspense fallback={null}>
          <WorkflowLibraryPanel onSelectTask={(taskId) => {
                dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
                dispatch({ type: "SELECT_EVENT", eventId: null });
                selectDashboardTask(taskId);
                setActivePanel(null);
            }} onClose={() => setActivePanel(null)}/>
        </Suspense>)}

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
function DashboardRoute(): React.JSX.Element {
    const { state, dispatch } = useMonitorStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const routeTaskId = searchParams.get("task");
    useLayoutEffect(() => {
        if (!routeTaskId || routeTaskId === state.selectedTaskId)
            return;
        dispatch({ type: "SELECT_TASK", taskId: routeTaskId });
    }, [dispatch, routeTaskId, state.selectedTaskId]);
    useEffect(() => {
        const currentTaskId = searchParams.get("task");
        if (!state.selectedTaskId)
            return;
        if (currentTaskId === state.selectedTaskId)
            return;
        if (currentTaskId && currentTaskId !== state.selectedTaskId)
            return;
        const next = new URLSearchParams(searchParams);
        next.set("task", state.selectedTaskId);
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, state.selectedTaskId]);
    return (<Dashboard onSelectTaskRoute={(taskId) => {
            const next = new URLSearchParams(searchParams);
            if (taskId) {
                next.set("task", taskId);
            }
            else {
                next.delete("task");
            }
            setSearchParams(next, { replace: true });
        }} onOpenTaskWorkspace={(taskId) => { void navigate(`/tasks/${encodeURIComponent(taskId)}?tab=overview`); }}/>);
}
function TaskWorkspaceRoute(): React.JSX.Element {
    const { taskId } = useParams<{
        readonly taskId: string;
    }>();
    if (!taskId)
        return <Navigate replace to="/"/>;
    return <TaskWorkspacePage taskId={taskId}/>;
}
function AppRoutes(): React.JSX.Element {
    return (<Suspense fallback={<div>Loading…</div>}>
      <Routes>
        <Route path="/" element={<DashboardRoute />}/>
        <Route path="/tasks/:taskId" element={<TaskWorkspaceRoute />}/>
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
