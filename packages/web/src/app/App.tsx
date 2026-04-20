import type React from "react";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { TaskId } from "../types.js";
import { getMonitorWsUrl } from "../io.js";
import { cn } from "./lib/ui/cn.js";
import { useUrlSearchParam } from "./shared/lib/urlState.js";
import { TopBar } from "./components/TopBar.js";
import { NavigationSidebar } from "./components/NavigationSidebar.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
const ApprovalQueuePanel = lazy(() => import("./components/ApprovalQueuePanel.js").then((m) => ({ default: m.ApprovalQueuePanel })));
const InspectorContainer = lazy(() => import("./components/InspectorContainer.js").then((m) => ({ default: m.InspectorContainer })));
import { TaskWorkspace } from "./features/task-workspace/index.js";
import { RuleCommandsPanel } from "./features/rule-commands/RuleCommandsPanel.js";
import { TaskRoute } from "./routes/task/TaskRoute.js";
import {
    QueryProvider,
    UiStoreProvider,
    monitorQueryKeys,
    useMonitorSocket,
    useSelectionStore,
    useSelectionStoreApi,
    useTaskDetailQuery,
    useTasksQuery,
} from "../state.js";
import { useTheme } from "./lib/useTheme.js";
import { KnowledgeBaseContent } from "./components/knowledge/KnowledgeBaseContent.js";
import { useDashboard, INSPECTOR_WIDTH } from "./features/dashboard/useDashboard.js";

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
    const db = useDashboard(view, { onSelectTaskRoute, onOpenTaskWorkspace });
    const [isRulesOpen, setIsRulesOpen] = useState(false);

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
            <TopBar
                isConnected={db.isConnected}
                {...(db.isStackedDashboard ? {
                    isNavigationOpen: db.isSidebarOpen,
                    onToggleNavigation: () => db.setIsSidebarOpen((value) => !value),
                } : {})}
                pendingApprovalCount={db.overviewData?.observability?.tasksAwaitingApproval ?? 0}
                blockedTaskCount={db.overviewData?.observability?.tasksBlockedByRule ?? 0}
                onOpenApprovalQueue={() => db.setIsApprovalQueueOpen(true)}
                searchQuery={db.search.query}
                searchResults={db.search.results}
                isSearching={db.search.isSearching}
                selectedTaskTitle={db.selectedTaskDisplayTitle ?? db.taskDetail?.task.title ?? null}
                taskScopeEnabled={db.search.taskScopeEnabled}
                onTaskScopeToggle={db.search.setTaskScopeEnabled}
                onSearchQueryChange={db.search.setQuery}
                onSelectSearchTask={db.handleSelectSearchTask}
                onSelectSearchEvent={db.handleSelectSearchEvent}
                onSelectSearchBookmark={db.handleSelectSearchBookmark}
                onRefresh={() => void db.queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() })}
                showFiltersButton={db.showGlobalFiltersButton}
                isFiltersOpen={db.isGlobalFiltersOpen}
                filtersButtonRef={db.globalFiltersButtonRef}
                onToggleFilters={db.handleToggleFilters}
                onToggleRules={() => setIsRulesOpen((v) => !v)}
                isRulesOpen={isRulesOpen}
            />
            {isRulesOpen && (
                <div className="fixed right-4 top-14 z-30 w-80 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                        <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Rule Commands</span>
                        <button className="text-[var(--text-3)] hover:text-[var(--text-1)]" onClick={() => setIsRulesOpen(false)} type="button">
                            <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="13"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        <RuleCommandsPanel {...(db.selectedTaskId != null ? { taskId: db.selectedTaskId as TaskId } : {})} />
                    </div>
                </div>
            )}

            <div className="relative flex flex-1 min-h-0 overflow-hidden">
                {db.isStackedDashboard ? (
                    <>
                        {db.isSidebarOpen && (
                            <button
                                aria-label="Close navigation"
                                className="absolute inset-0 z-20 bg-[color-mix(in_srgb,var(--text-1)_18%,transparent)] backdrop-blur-[1px]"
                                onClick={() => db.setIsSidebarOpen(false)}
                                type="button"
                            />
                        )}
                        <div className={cn("absolute inset-y-0 left-0 z-30 transition-transform duration-200 ease-out", db.isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                            <NavigationSidebar
                                className="w-[min(18rem,calc(100vw-1rem))] shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
                                isConnected={db.isConnected}
                                activeView={db.sidebarView}
                                onNavigate={() => db.setIsSidebarOpen(false)}
                                onChangeView={db.handleSidebarViewChange}
                                tasks={db.tasks}
                                bookmarks={db.bookmarks}
                                selectedTaskBookmarkId={db.selectedTaskBookmark?.id ?? null}
                                selectedTaskId={db.selectedTaskId}
                                taskDetail={db.taskDetail ?? null}
                                selectedTaskQuestionCount={db.questionCount}
                                selectedTaskTodoCount={db.todoCount}
                                deletingTaskId={db.deletingTaskId}
                                deleteErrorTaskId={db.deleteErrorTaskId}
                                onSelectTask={db.handleSelectDashboardTask}
                                onSelectBookmark={db.handleSelectBookmark}
                                onDeleteBookmark={db.handleDeleteBookmarkWithError}
                                onDeleteTask={(id) => void db.handleDeleteTask(id)}
                            />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 p-2.5">
                            {view === "knowledge" ? (
                                <KnowledgeBaseContent onSelectTask={db.handleSelectDashboardTask} />
                            ) : view === "workspace" && workspaceTaskId ? (
                                <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]"/>}>
                                    <TaskWorkspace
                                        taskId={workspaceTaskId}
                                        embedded
                                        externalFiltersState={db.externalFiltersState}
                                        externalTimelineFilters={db.externalTimelineFilters}
                                    />
                                </Suspense>
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={true} zoom={db.zoom} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={db.selectedTaskUsesDerivedTitle} onZoomChange={db.setZoom} externalFiltersState={db.externalFiltersState} externalTimelineFilters={db.externalTimelineFilters}/>
                            )}
                            {view === "timeline" && db.isInspectorOpen && (
                                <Suspense fallback={<div className="min-h-[20rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"/>}>
                                    <InspectorContainer isStackedDashboard={true} isInspectorCollapsed={false} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} onToggleCollapse={() => {}} onOpenTaskWorkspace={db.selectedTaskId ? () => db.handleOpenTaskWorkspace(db.selectedTaskId!) : undefined}/>
                                </Suspense>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <NavigationSidebar
                            isConnected={db.isConnected}
                            activeView={db.sidebarView}
                            onChangeView={db.handleSidebarViewChange}
                            tasks={db.tasks}
                            bookmarks={db.bookmarks}
                            selectedTaskBookmarkId={db.selectedTaskBookmark?.id ?? null}
                            selectedTaskId={db.selectedTaskId}
                            taskDetail={db.taskDetail ?? null}
                            selectedTaskQuestionCount={db.questionCount}
                            selectedTaskTodoCount={db.todoCount}
                            deletingTaskId={db.deletingTaskId}
                            deleteErrorTaskId={db.deleteErrorTaskId}
                            onSelectTask={db.handleSelectDashboardTask}
                            onSelectBookmark={db.handleSelectBookmark}
                            onDeleteBookmark={db.handleDeleteBookmarkWithError}
                            onDeleteTask={(id) => void db.handleDeleteTask(id)}
                        />
                        <div
                            className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2.5 transition-[padding-right] duration-200"
                            style={{ paddingRight: (view === "timeline" && db.isInspectorOpen) ? `${(db.isInspectorCollapsed ? 44 : INSPECTOR_WIDTH) + 10}px` : undefined }}
                        >
                            {view === "knowledge" ? (
                                <KnowledgeBaseContent onSelectTask={db.handleSelectDashboardTask} />
                            ) : view === "workspace" && workspaceTaskId ? (
                                <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-1)]"/>}>
                                    <TaskWorkspace
                                        taskId={workspaceTaskId}
                                        embedded
                                        externalFiltersState={db.externalFiltersState}
                                        externalTimelineFilters={db.externalTimelineFilters}
                                    />
                                </Suspense>
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={false} zoom={db.zoom} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={db.selectedTaskUsesDerivedTitle} onZoomChange={db.setZoom} externalFiltersState={db.externalFiltersState} externalTimelineFilters={db.externalTimelineFilters}/>
                            )}
                        </div>
                        {view === "timeline" && (
                            <div
                                className={cn("absolute bottom-0 right-0 top-0 z-10 flex flex-col transition-[transform,width] duration-200 ease-out", db.isInspectorOpen ? "translate-x-0" : "translate-x-full")}
                                style={{ width: db.isInspectorCollapsed ? 44 : INSPECTOR_WIDTH }}
                            >
                                {db.isInspectorCollapsed ? (
                                    <div className="flex h-full flex-col items-center border-l border-[var(--border)] bg-[var(--surface)] pt-3">
                                        <button
                                            aria-label="Expand inspector"
                                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-sm transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                            onClick={() => db.setIsInspectorCollapsed(false)}
                                            type="button"
                                        >
                                            <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                                                <path d="M15 18l-6-6 6-6"/>
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <Suspense fallback={<div className="h-full border-l border-[var(--border)] bg-[var(--surface)]"/>}>
                                        <InspectorContainer isStackedDashboard={false} isInspectorCollapsed={false} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} onToggleCollapse={() => db.setIsInspectorCollapsed(true)} onOpenTaskWorkspace={db.selectedTaskId ? () => db.handleOpenTaskWorkspace(db.selectedTaskId!) : undefined}/>
                                    </Suspense>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {db.isApprovalQueueOpen && (
                <Suspense fallback={null}>
                    <ApprovalQueuePanel
                        tasks={db.tasks}
                        onClose={() => db.setIsApprovalQueueOpen(false)}
                        onRefresh={() => db.queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() })}
                        onSelectTask={(taskId) => {
                            db.selectDashboardTask(taskId);
                            db.setIsApprovalQueueOpen(false);
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

    useLayoutEffect(() => {
        if (routeTaskId === selectedTaskId) return;
        selectTask(routeTaskId);
    }, [routeTaskId, selectedTaskId, selectTask]);

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

function AppInner(): React.JSX.Element {
    const selectionStore = useSelectionStoreApi();
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const setConnected = useSelectionStore((s) => s.setConnected);
    const selectEvent = useSelectionStore((s) => s.selectEvent);
    const resetFilters = useSelectionStore((s) => s.resetFilters);

    useMonitorSocket({
        url: getMonitorWsUrl(),
        selectedTaskId: selectedTaskId != null ? (selectedTaskId as TaskId) : null,
        onConnectionChange: setConnected,
    });

    const { data: taskDetail } = useTaskDetailQuery(
        selectedTaskId != null ? (selectedTaskId as TaskId) : null
    );
    const prevTaskIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!taskDetail) return;
        if (taskDetail.task.id === prevTaskIdRef.current) return;
        prevTaskIdRef.current = taskDetail.task.id;

        const store = selectionStore.getState();
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
        const current = store.selectedEventId;
        const valid = current != null && taskDetail.timeline.some((e) => e.id === current);
        const next = valid ? current : (taskDetail.timeline[taskDetail.timeline.length - 1]?.id ?? null);
        if (next !== current) {
            selectEvent(next);
        }
    }, [taskDetail?.task.id]);

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
