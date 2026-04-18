import type React from "react";
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { TaskId } from "@monitor/domain";
import { BookmarkId, TaskId as toTaskId } from "@monitor/domain";
import { buildQuestionGroups, buildTaskDisplayTitle, buildTodoGroups } from "@monitor/web-domain";
import type { BookmarkRecord, BookmarkSearchHit } from "@monitor/web-domain";
import { deleteBookmark, deleteTask, getMonitorWsUrl } from "@monitor/web-io";
import { cn } from "./lib/ui/cn.js";
import { useUrlSearchParam } from "./shared/lib/urlState.js";
import { TopBar } from "./components/TopBar.js";
import { NavigationSidebar } from "./components/NavigationSidebar.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
const ApprovalQueuePanel = lazy(() => import("./components/ApprovalQueuePanel.js").then((m) => ({ default: m.ApprovalQueuePanel })));
const InspectorContainer = lazy(() => import("./components/InspectorContainer.js").then((m) => ({ default: m.InspectorContainer })));
import { TaskWorkspace } from "./features/task-workspace/";
import { TaskRoute } from "./routes/task/TaskRoute.js";
import {
    QueryProvider,
    UiStoreProvider,
    monitorQueryKeys,
    useBookmarksQuery,
    useMonitorSocket,
    useOverviewQuery,
    useSelectionStore,
    useSelectionStoreApi,
    useTaskDetailQuery,
    useTasksQuery,
    useSearch,
} from "@monitor/web-state";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "./lib/useTheme.js";
import { KnowledgeBaseContent } from "./components/knowledge/KnowledgeBaseContent.js";
import type { TimelineLane } from "@monitor/web-domain";

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";
const INSPECTOR_WIDTH = 360;
const DASHBOARD_STACKED_BREAKPOINT = 1024;

function Dashboard({
    view = "timeline",
    workspaceTaskId,
    onOpenTaskWorkspace,
    onSelectTaskRoute,
}: {
    readonly view?: "timeline" | "knowledge" | "workspace";
    readonly workspaceTaskId?: string | undefined;
    readonly onOpenTaskWorkspace: (taskId: string) => void;
    readonly onSelectTaskRoute: (taskId: string | null) => void;
}): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const isConnected = useSelectionStore((s) => s.isConnected);
    const deletingTaskId = useSelectionStore((s) => s.deletingTaskId);
    const deleteErrorTaskId = useSelectionStore((s) => s.deleteErrorTaskId);
    const selectTask = useSelectionStore((s) => s.selectTask);
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const selectConnector = useSelectionStore((s) => s.selectConnector);
    const setDeletingTaskId = useSelectionStore((s) => s.setDeletingTaskId);
    const setDeleteErrorTaskId = useSelectionStore((s) => s.setDeleteErrorTaskId);

    const { data: tasksData } = useTasksQuery();
    const { data: bookmarksData } = useBookmarksQuery();
    const { data: overviewData } = useOverviewQuery();
    const { data: taskDetail } = useTaskDetailQuery(selectedTaskId != null ? (selectedTaskId as TaskId) : null);
    const queryClient = useQueryClient();

    const tasks = tasksData?.tasks ?? [];
    const bookmarks = bookmarksData?.bookmarks ?? [];

    const { query: searchQuery, setQuery: setSearchQuery, results: searchResults, isSearching, taskScopeEnabled, setTaskScopeEnabled } = useSearch(selectedTaskId ?? undefined);
    const [sidebarView, setSidebarView] = useState<"tasks" | "saved">("tasks");
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const isInspectorOpen = Boolean(selectedTaskId);
    const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const isStackedDashboard = viewportWidth < DASHBOARD_STACKED_BREAKPOINT;

    useEffect(() => {
        if (!isInspectorOpen) setIsInspectorCollapsed(false);
    }, [isInspectorOpen]);
    useEffect(() => {
        const handleResize = (): void => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
    useEffect(() => {
        if (!isStackedDashboard) setIsSidebarOpen(false);
    }, [isStackedDashboard]);
    useEffect(() => {
        if (isStackedDashboard && isInspectorCollapsed) setIsInspectorCollapsed(false);
    }, [isInspectorCollapsed, isStackedDashboard]);

    const [isApprovalQueueOpen, setIsApprovalQueueOpen] = useState(false);
    const [isGlobalFiltersOpen, setIsGlobalFiltersOpen] = useState(false);
    const [globalFiltersPos, setGlobalFiltersPos] = useState({ top: 0, right: 0 });
    const globalFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const [timelineFilters, setTimelineFilters] = useState<Record<TimelineLane, boolean>>({
        user: true,
        exploration: true,
        planning: true,
        coordination: true,
        background: true,
        implementation: true,
        questions: true,
        todos: true,
        telemetry: false,
    });
    const [zoom, setZoom] = useState<number>(() => {
        try {
            const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
            if (!raw) return ZOOM_DEFAULT;
            const parsed = Number.parseFloat(raw);
            if (!Number.isFinite(parsed)) return ZOOM_DEFAULT;
            return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
        } catch {
            return ZOOM_DEFAULT;
        }
    });
    useEffect(() => {
        try { window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom)); } catch { /* storage unavailable */ }
    }, [zoom]);
    const showGlobalFiltersButton = (view === "timeline" && Boolean(selectedTaskId)) || (view === "workspace" && Boolean(workspaceTaskId));
    useEffect(() => {
        if (!showGlobalFiltersButton) {
            setIsGlobalFiltersOpen(false);
        }
    }, [showGlobalFiltersButton]);

    const selectedTaskDisplayTitle = useMemo(
        () => (taskDetail?.task ? buildTaskDisplayTitle(taskDetail.task, taskDetail.timeline) : null),
        [taskDetail]
    );
    const selectedTaskUsesDerivedTitle = Boolean(
        taskDetail?.task &&
        selectedTaskDisplayTitle &&
        selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim()
    );

    const selectDashboardTask = useCallback(
        (taskId: string | null): void => {
            onSelectTaskRoute(taskId);
        },
        [onSelectTaskRoute]
    );

    const handleDeleteTask = useCallback(
        async (taskId: string): Promise<void> => {
            setDeletingTaskId(taskId);
            try {
                await deleteTask(toTaskId(taskId));
                if (selectedTaskId === taskId) {
                    selectTask(null);
                    onSelectTaskRoute(null);
                }
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.tasks() }),
                    queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() }),
                ]);
            } catch {
                setDeleteErrorTaskId(taskId);
                setTimeout(() => setDeleteErrorTaskId(null), 2000);
            } finally {
                setDeletingTaskId(null);
            }
        },
        [selectedTaskId, selectTask, onSelectTaskRoute, setDeletingTaskId, setDeleteErrorTaskId, queryClient]
    );

    const handleDeleteBookmark = useCallback(
        async (bookmarkId: string): Promise<void> => {
            await deleteBookmark(BookmarkId(bookmarkId));
            await queryClient.invalidateQueries({ queryKey: monitorQueryKeys.bookmarks() });
        },
        [queryClient]
    );

    const handleSidebarViewChange = useCallback(
        (view: "tasks" | "saved"): void => {
            setSidebarView(view);
            if (isStackedDashboard) setIsSidebarOpen(false);
        },
        [isStackedDashboard]
    );
    const handleSelectDashboardTask = useCallback(
        (taskId: string): void => {
            if (isStackedDashboard) setIsSidebarOpen(false);
            selectDashboardTask(taskId);
        },
        [isStackedDashboard, selectDashboardTask]
    );

    const selectedTaskBookmark = bookmarks.find((b) => b.taskId === (selectedTaskId ?? "") && !b.eventId) ?? null;
    const taskTimeline = taskDetail?.timeline ?? [];
    const questionCount = useMemo(() => buildQuestionGroups(taskTimeline).length, [taskTimeline]);
    const todoCount = useMemo(() => buildTodoGroups(taskTimeline).length, [taskTimeline]);

    const handleSelectBookmark = useCallback(
        (bookmark: BookmarkRecord): void => {
            if (isStackedDashboard) setIsSidebarOpen(false);
            selectConnector(null);
            selectDashboardTask(bookmark.taskId);
            selectEvent(bookmark.eventId ?? null);
        },
        [isStackedDashboard, selectConnector, selectDashboardTask, selectEvent]
    );

    const handleDeleteBookmarkWithError = useCallback(
        (bookmarkId: string): void => {
            void handleDeleteBookmark(bookmarkId);
        },
        [handleDeleteBookmark]
    );

    const handleSelectSearchTask = useCallback(
        (taskId: string): void => {
            setSearchQuery("");
            selectConnector(null);
            selectEvent(null);
            selectDashboardTask(taskId);
        },
        [selectConnector, selectDashboardTask, selectEvent, setSearchQuery]
    );
    const handleSelectSearchEvent = useCallback(
        (taskId: string, eventId: string): void => {
            setSearchQuery("");
            selectConnector(null);
            selectDashboardTask(taskId);
            selectEvent(eventId);
        },
        [selectConnector, selectDashboardTask, selectEvent, setSearchQuery]
    );
    const handleSelectSearchBookmark = useCallback(
        (bookmark: BookmarkSearchHit): void => {
            setSearchQuery("");
            const target = bookmarks.find((item) => item.id === bookmark.bookmarkId);
            if (target) {
                selectConnector(null);
                selectDashboardTask(target.taskId);
                selectEvent(target.eventId ?? null);
                return;
            }
            selectConnector(null);
            if (bookmark.eventId) {
                selectDashboardTask(bookmark.taskId);
                selectEvent(bookmark.eventId);
            } else {
                selectEvent(null);
                selectDashboardTask(bookmark.taskId);
            }
        },
        [bookmarks, selectConnector, selectDashboardTask, selectEvent, setSearchQuery]
    );

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
            <TopBar
                isConnected={isConnected}
                {...(isStackedDashboard ? {
                    isNavigationOpen: isSidebarOpen,
                    onToggleNavigation: () => setIsSidebarOpen((value) => !value),
                } : {})}
                pendingApprovalCount={overviewData?.observability?.tasksAwaitingApproval ?? 0}
                blockedTaskCount={overviewData?.observability?.tasksBlockedByRule ?? 0}
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
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() })}
                showFiltersButton={showGlobalFiltersButton}
                isFiltersOpen={isGlobalFiltersOpen}
                filtersButtonRef={globalFiltersButtonRef}
                onToggleFilters={() => {
                    if (globalFiltersButtonRef.current) {
                        const rect = globalFiltersButtonRef.current.getBoundingClientRect();
                        setGlobalFiltersPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                    }
                    setIsGlobalFiltersOpen((value) => !value);
                }}
            />

            <div className="relative flex flex-1 min-h-0 overflow-hidden">
                {isStackedDashboard ? (
                    <>
                        {isSidebarOpen && (
                            <button
                                aria-label="Close navigation"
                                className="absolute inset-0 z-20 bg-[color-mix(in_srgb,var(--text-1)_18%,transparent)] backdrop-blur-[1px]"
                                onClick={() => setIsSidebarOpen(false)}
                                type="button"
                            />
                        )}
                        <div className={cn("absolute inset-y-0 left-0 z-30 transition-transform duration-200 ease-out", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                            <NavigationSidebar
                                className="w-[min(18rem,calc(100vw-1rem))] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
                                isConnected={isConnected}
                                activeView={sidebarView}
                                onNavigate={() => setIsSidebarOpen(false)}
                                onChangeView={handleSidebarViewChange}
                                tasks={tasks}
                                bookmarks={bookmarks}
                                selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
                                selectedTaskId={selectedTaskId}
                                taskDetail={taskDetail ?? null}
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
                                    <TaskWorkspace
                                        taskId={workspaceTaskId}
                                        embedded
                                        externalFiltersState={{ isOpen: isGlobalFiltersOpen, setIsOpen: setIsGlobalFiltersOpen, popoverPos: globalFiltersPos, setPopoverPos: setGlobalFiltersPos, buttonRef: globalFiltersButtonRef }}
                                        externalTimelineFilters={{ filters: timelineFilters, setFilters: setTimelineFilters }}
                                    />
                                </Suspense>
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={true} zoom={zoom} selectedTaskDisplayTitle={selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle} onZoomChange={setZoom} externalFiltersState={{ isOpen: isGlobalFiltersOpen, setIsOpen: setIsGlobalFiltersOpen, popoverPos: globalFiltersPos, setPopoverPos: setGlobalFiltersPos, buttonRef: globalFiltersButtonRef }} externalTimelineFilters={{ filters: timelineFilters, setFilters: setTimelineFilters }}/>
                            )}
                            {view === "timeline" && isInspectorOpen && (
                                <Suspense fallback={<div className="min-h-[20rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"/>}>
                                    <InspectorContainer isStackedDashboard={true} isInspectorCollapsed={false} selectedTaskDisplayTitle={selectedTaskDisplayTitle} onToggleCollapse={() => {}} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
                                </Suspense>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <NavigationSidebar
                            isConnected={isConnected}
                            activeView={sidebarView}
                            onChangeView={handleSidebarViewChange}
                            tasks={tasks}
                            bookmarks={bookmarks}
                            selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
                            selectedTaskId={selectedTaskId}
                            taskDetail={taskDetail ?? null}
                            selectedTaskQuestionCount={questionCount}
                            selectedTaskTodoCount={todoCount}
                            deletingTaskId={deletingTaskId}
                            deleteErrorTaskId={deleteErrorTaskId}
                            onSelectTask={handleSelectDashboardTask}
                            onSelectBookmark={handleSelectBookmark}
                            onDeleteBookmark={handleDeleteBookmarkWithError}
                            onDeleteTask={(id) => void handleDeleteTask(id)}
                        />
                        <div
                            className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2.5 transition-[padding-right] duration-200"
                            style={{ paddingRight: (view === "timeline" && isInspectorOpen) ? `${(isInspectorCollapsed ? 44 : INSPECTOR_WIDTH) + 10}px` : undefined }}
                        >
                            {view === "knowledge" ? (
                                <KnowledgeBaseContent onSelectTask={handleSelectDashboardTask} />
                            ) : view === "workspace" && workspaceTaskId ? (
                                <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]"/>}>
                                    <TaskWorkspace
                                        taskId={workspaceTaskId}
                                        embedded
                                        externalFiltersState={{ isOpen: isGlobalFiltersOpen, setIsOpen: setIsGlobalFiltersOpen, popoverPos: globalFiltersPos, setPopoverPos: setGlobalFiltersPos, buttonRef: globalFiltersButtonRef }}
                                        externalTimelineFilters={{ filters: timelineFilters, setFilters: setTimelineFilters }}
                                    />
                                </Suspense>
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={false} zoom={zoom} selectedTaskDisplayTitle={selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={selectedTaskUsesDerivedTitle} onZoomChange={setZoom} externalFiltersState={{ isOpen: isGlobalFiltersOpen, setIsOpen: setIsGlobalFiltersOpen, popoverPos: globalFiltersPos, setPopoverPos: setGlobalFiltersPos, buttonRef: globalFiltersButtonRef }} externalTimelineFilters={{ filters: timelineFilters, setFilters: setTimelineFilters }}/>
                            )}
                        </div>
                        {view === "timeline" && (
                            <div
                                className={cn("absolute bottom-0 right-0 top-0 z-10 flex flex-col transition-[transform,width] duration-200 ease-out", isInspectorOpen ? "translate-x-0" : "translate-x-full")}
                                style={{ width: isInspectorCollapsed ? 44 : INSPECTOR_WIDTH }}
                            >
                                {isInspectorCollapsed ? (
                                    <div className="flex h-full flex-col items-center border-l border-[var(--border)] bg-[var(--surface)] pt-3">
                                        <button
                                            aria-label="Expand inspector"
                                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                            onClick={() => setIsInspectorCollapsed(false)}
                                            type="button"
                                        >
                                            <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                                                <path d="M15 18l-6-6 6-6"/>
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <Suspense fallback={<div className="h-full border-l border-[var(--border)] bg-[var(--surface)]"/>}>
                                        <InspectorContainer isStackedDashboard={false} isInspectorCollapsed={false} selectedTaskDisplayTitle={selectedTaskDisplayTitle} onToggleCollapse={() => setIsInspectorCollapsed(true)} onOpenTaskWorkspace={selectedTaskId ? () => onOpenTaskWorkspace(selectedTaskId) : undefined}/>
                                    </Suspense>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {isApprovalQueueOpen && (
                <Suspense fallback={null}>
                    <ApprovalQueuePanel
                        tasks={tasks}
                        onClose={() => setIsApprovalQueueOpen(false)}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() })}
                        onSelectTask={(taskId) => {
                            selectConnector(null);
                            selectEvent(null);
                            selectDashboardTask(taskId);
                            setIsApprovalQueueOpen(false);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
}

function DashboardRoute({ view = "timeline" }: { readonly view?: "timeline" | "knowledge" }): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectTask = useSelectionStore((s) => s.selectTask);
    const [routeTaskId, setRouteTaskId] = useUrlSearchParam("task");
    const [routeView, setRouteView] = useUrlSearchParam("view");
    const { data: tasksData, isSuccess: tasksReady } = useTasksQuery();
    const tasks = tasksData?.tasks ?? [];
    const navigate = useNavigate();
    const resolvedView = view === "knowledge"
        ? "knowledge"
        : routeView === "workspace"
            ? "workspace"
            : "timeline";

    // One-way: URL is the source of truth, mirror into store on change.
    useLayoutEffect(() => {
        if (routeTaskId === selectedTaskId) return;
        selectTask(routeTaskId);
    }, [routeTaskId, selectedTaskId, selectTask]);

    // Auto-select first task when tasks load and no task is in URL.
    useEffect(() => {
        if (routeTaskId !== null) return;
        if (!tasksReady) return;
        const firstTask = tasks[0];
        if (!firstTask) return;
        setRouteTaskId(firstTask.id);
    }, [routeTaskId, setRouteTaskId, tasksReady, tasks]);

    return (
        <Dashboard
            view={resolvedView}
            {...(resolvedView === "workspace" && (routeTaskId ?? selectedTaskId) ? { workspaceTaskId: routeTaskId ?? selectedTaskId ?? undefined } : {})}
            onSelectTaskRoute={setRouteTaskId}
            onOpenTaskWorkspace={(taskId) => {
                setRouteTaskId(taskId);
                setRouteView("workspace");
                void navigate(`/?task=${encodeURIComponent(taskId)}&view=workspace&tab=overview`, { replace: true });
            }}
        />
    );
}

function AppRoutes(): React.JSX.Element {
    return (
        <Suspense fallback={<div>Loading…</div>}>
            <Routes>
                <Route path="/" element={<DashboardRoute />}/>
                <Route path="/tasks/:taskId" element={<TaskRoute />}/>
                <Route path="/knowledge" element={<DashboardRoute view="knowledge" />}/>
                <Route path="*" element={<Navigate replace to="/"/>}/>
            </Routes>
        </Suspense>
    );
}

/** Mounted inside QueryProvider so it can use useQueryClient. */
function AppInner(): React.JSX.Element {
    const selectionStore = useSelectionStoreApi();
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const setConnected = useSelectionStore((s) => s.setConnected);
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const resetFilters = useSelectionStore((s) => s.resetFilters);

    // Single WebSocket connection for the whole app.
    useMonitorSocket({
        url: getMonitorWsUrl(),
        selectedTaskId: selectedTaskId != null ? (selectedTaskId as TaskId) : null,
        onConnectionChange: setConnected,
    });

    // Auto-select the last event whenever the active task's detail loads.
    const { data: taskDetail } = useTaskDetailQuery(
        selectedTaskId != null ? (selectedTaskId as TaskId) : null
    );
    const prevTaskIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!taskDetail) return;
        if (taskDetail.task.id === prevTaskIdRef.current) return;
        prevTaskIdRef.current = taskDetail.task.id;

        const store = selectionStore.getState();
        // Invalidate connector if its events are no longer in the new timeline.
        const { selectedConnectorKey: ck } = store;
        if (ck) {
            const [s, tPart] = ck.split("→");
            if (s && tPart) {
                const [t] = tPart.split(":");
                if (
                    t &&
                    (!taskDetail.timeline.some((e) => e.id === s) ||
                        !taskDetail.timeline.some((e) => e.id === t))
                ) {
                    store.selectConnector(null);
                }
            }
        }
        // Auto-select the last timeline event.
        const current = store.selectedEventId;
        const valid = current != null && taskDetail.timeline.some((e) => e.id === current);
        const next = valid ? current : (taskDetail.timeline[taskDetail.timeline.length - 1]?.id ?? null);
        if (next !== current) {
            selectEvent(next);
        }
    }, [taskDetail?.task.id]);

    // Reset timeline filters whenever the selected task changes.
    useEffect(() => {
        resetFilters();
    }, [selectedTaskId]);

    return <AppRoutes />;
}

export function App(): React.JSX.Element {
    useTheme();
    return (
        <QueryProvider>
            <UiStoreProvider>
                <AppInner />
            </UiStoreProvider>
        </QueryProvider>
    );
}
