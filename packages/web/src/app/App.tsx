import type React from "react";
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { TaskId } from "../types.js";
import { getMonitorWsUrl } from "../io.js";
import { cn } from "./lib/ui/cn.js";
import { useUrlSearchParam } from "./shared/lib/urlState.js";
import { TopBar } from "./components/TopBar.js";
import { NavigationSidebar } from "./components/NavigationSidebar.js";
import { TimelineContainer } from "./components/TimelineContainer.js";
const ApprovalQueuePanel = lazy(() => import("./components/ApprovalQueuePanel.js").then((m) => ({ default: m.ApprovalQueuePanel })));
const InspectorContainer = lazy(() => import("./components/InspectorContainer.js").then((m) => ({ default: m.InspectorContainer })));
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
import { RulesContent } from "./components/rules/RulesContent.js";
import { useDashboard } from "./features/dashboard/useDashboard.js";
import { NotificationsBanner } from "./features/onboarding/NotificationsBanner.js";

function Dashboard({
    view = "timeline",
    onSelectTaskRoute,
}: {
    readonly view?: "timeline" | "knowledge" | "rules";
    readonly onSelectTaskRoute: (taskId: string | null) => void;
}): React.JSX.Element {
    const db = useDashboard(view, { onSelectTaskRoute });
    // Task Rules overlay (replaces main panel when active). Local state, not in URL —
    // it's a transient drilldown from inspector and dismissing returns to dashboard.
    const [taskRulesViewId, setTaskRulesViewId] = useState<string | null>(null);
    const handleOpenTaskRules = (taskId: string) => setTaskRulesViewId(taskId);

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">
            <NotificationsBanner />
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
                onRefresh={() => void db.queryClient.invalidateQueries({ queryKey: monitorQueryKeys.overview() })}
                showFiltersButton={db.showGlobalFiltersButton}
                isFiltersOpen={db.isGlobalFiltersOpen}
                filtersButtonRef={db.globalFiltersButtonRef}
                onToggleFilters={db.handleToggleFilters}
                selectedTaskId={db.selectedTaskId}
                onOpenTaskRules={handleOpenTaskRules}
                onViewModeChange={() => setTaskRulesViewId(null)}
                isTaskRulesOpen={taskRulesViewId != null}
            />

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
                                onNavigate={() => db.setIsSidebarOpen(false)}
                                tasks={db.tasks}
                                selectedTaskId={db.selectedTaskId}
                                taskDetail={db.taskDetail ?? null}
                                selectedTaskQuestionCount={db.questionCount}
                                selectedTaskTodoCount={db.todoCount}
                                deletingTaskId={db.deletingTaskId}
                                deleteErrorTaskId={db.deleteErrorTaskId}
                                onSelectTask={db.handleSelectDashboardTask}
                                onDeleteTask={(id) => void db.handleDeleteTask(id)}
                            />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 p-2.5">
                            {taskRulesViewId ? (
                                <RulesContent taskId={taskRulesViewId} />
                            ) : view === "knowledge" ? (
                                <KnowledgeBaseContent onSelectTask={db.handleSelectDashboardTask} />
                            ) : view === "rules" ? (
                                <RulesContent />
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={true} zoom={db.zoom} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={db.selectedTaskUsesDerivedTitle} onZoomChange={db.setZoom} externalFiltersState={db.externalFiltersState} externalTimelineFilters={db.externalTimelineFilters}/>
                            )}
                            {view === "timeline" && db.isInspectorOpen && (
                                <Suspense fallback={<div className="min-h-[20rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"/>}>
                                    <InspectorContainer isStackedDashboard={true} isInspectorCollapsed={false} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} onToggleCollapse={() => {}}/>
                                </Suspense>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <NavigationSidebar
                            isConnected={db.isConnected}
                            tasks={db.tasks}
                            selectedTaskId={db.selectedTaskId}
                            taskDetail={db.taskDetail ?? null}
                            selectedTaskQuestionCount={db.questionCount}
                            selectedTaskTodoCount={db.todoCount}
                            deletingTaskId={db.deletingTaskId}
                            deleteErrorTaskId={db.deleteErrorTaskId}
                            onSelectTask={db.handleSelectDashboardTask}
                            onDeleteTask={(id) => void db.handleDeleteTask(id)}
                        />
                        <div
                            className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2.5 transition-[padding-right] duration-200"
                            style={{ paddingRight: (view === "timeline" && db.isInspectorOpen) ? `${(db.isInspectorCollapsed ? 44 : db.inspectorWidth) + 10}px` : undefined }}
                        >
                            {taskRulesViewId ? (
                                <RulesContent taskId={taskRulesViewId} />
                            ) : view === "knowledge" ? (
                                <KnowledgeBaseContent onSelectTask={db.handleSelectDashboardTask} />
                            ) : view === "rules" ? (
                                <RulesContent />
                            ) : (
                                <TimelineContainer isCompactDashboard={false} isStackedDashboard={false} zoom={db.zoom} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} selectedTaskUsesDerivedTitle={db.selectedTaskUsesDerivedTitle} onZoomChange={db.setZoom} externalFiltersState={db.externalFiltersState} externalTimelineFilters={db.externalTimelineFilters}/>
                            )}
                        </div>
                        {view === "timeline" && (
                            <div
                                className={cn("absolute bottom-0 right-0 top-0 z-10 flex flex-col transition-[transform] duration-200 ease-out", db.isInspectorOpen ? "translate-x-0" : "translate-x-full")}
                                style={{ width: db.isInspectorCollapsed ? 44 : db.inspectorWidth }}
                            >
                                {!db.isInspectorCollapsed && (
                                    <div
                                        role="separator"
                                        aria-orientation="vertical"
                                        aria-label="Resize inspector"
                                        title="Drag to resize"
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            const startX = event.clientX;
                                            const startWidth = db.inspectorWidth;
                                            const onMove = (moveEvent: PointerEvent): void => {
                                                db.setInspectorWidth(startWidth + (startX - moveEvent.clientX));
                                            };
                                            const onUp = (): void => {
                                                window.removeEventListener("pointermove", onMove);
                                                window.removeEventListener("pointerup", onUp);
                                            };
                                            window.addEventListener("pointermove", onMove);
                                            window.addEventListener("pointerup", onUp);
                                        }}
                                        className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize bg-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
                                    />
                                )}
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
                                        <InspectorContainer isStackedDashboard={false} isInspectorCollapsed={false} selectedTaskDisplayTitle={db.selectedTaskDisplayTitle} onToggleCollapse={() => db.setIsInspectorCollapsed(true)}/>
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

function DashboardRoute({ view = "timeline" }: { readonly view?: "timeline" | "knowledge" | "rules" }): React.JSX.Element {
    const selectedTaskId = useSelectionStore((s) => s.selectedTaskId);
    const selectTask = useSelectionStore((s) => s.selectTask);
    const [routeTaskId, setRouteTaskId] = useUrlSearchParam("task");
    const { data: tasksData, isSuccess: tasksReady } = useTasksQuery();
    const tasks = tasksData?.tasks ?? [];

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
            view={view}
            onSelectTaskRoute={setRouteTaskId}
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
                <Route path="/rules" element={<DashboardRoute view="rules" />}/>
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
