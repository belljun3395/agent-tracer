import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskId } from "~domain/monitoring.js";
import { TaskId as toTaskId } from "~domain/monitoring.js";
import { buildTaskDisplayTitle } from "~app/lib/insights/extraction.js";
import { buildQuestionGroups, buildTodoGroups } from "~app/lib/insights/grouping.js";
import type { TimelineLane } from "~domain/monitoring.js";
import { deleteTask } from "~io/api.js";
import { useOverviewQuery, useTaskDetailQuery, useTasksQuery } from "~state/server/queries.js";
import { monitorQueryKeys } from "~state/server/queryKeys.js";
import { useSelectionStore } from "~state/ui/UiStoreProvider.js";
import { useSearch } from "~state/useSearch.js";
import { useQueryClient } from "@tanstack/react-query";

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 2.5;
const ZOOM_DEFAULT = 1.1;
const ZOOM_STORAGE_KEY = "agent-tracer.zoom";
const INSPECTOR_WIDTH_DEFAULT = 360;
const INSPECTOR_WIDTH_MIN = 280;
const INSPECTOR_WIDTH_MAX = 800;
const INSPECTOR_WIDTH_STORAGE_KEY = "agent-tracer.inspector-width";
const DASHBOARD_STACKED_BREAKPOINT = 1024;

function loadInspectorWidth(): number {
    if (typeof localStorage === "undefined") return INSPECTOR_WIDTH_DEFAULT;
    const raw = localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
    if (!raw) return INSPECTOR_WIDTH_DEFAULT;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return INSPECTOR_WIDTH_DEFAULT;
    return Math.max(INSPECTOR_WIDTH_MIN, Math.min(INSPECTOR_WIDTH_MAX, parsed));
}

export function useDashboard(
    _view: "timeline" | "workspace",
    { onSelectTaskRoute }: {
        onSelectTaskRoute: (taskId: string | null) => void;
    }
) {
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
    const { data: overviewData } = useOverviewQuery();
    const { data: taskDetail } = useTaskDetailQuery(selectedTaskId != null ? (selectedTaskId as TaskId) : null);
    const queryClient = useQueryClient();

    const tasks = tasksData?.tasks ?? [];

    const search = useSearch(selectedTaskId ?? undefined);
    const clearSearchQuery = search.setQuery;

    const [sidebarView, setSidebarView] = useState<"tasks" | "rules">("tasks");
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGlobalFiltersOpen, setIsGlobalFiltersOpen] = useState(false);
    const [globalFiltersPos, setGlobalFiltersPos] = useState({ top: 0, right: 0 });
    const globalFiltersButtonRef = useRef<HTMLButtonElement>(null);
    const [timelineFilters, setTimelineFilters] = useState<Record<TimelineLane, boolean>>({
        user: true, exploration: true, planning: true, coordination: true,
        background: true, implementation: true, rule: true, questions: true, todos: true, telemetry: false,
    });
    const [zoom, setZoom] = useState<number>(() => {
        try {
            const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
            if (!raw) return ZOOM_DEFAULT;
            const parsed = Number.parseFloat(raw);
            if (!Number.isFinite(parsed)) return ZOOM_DEFAULT;
            return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parsed));
        } catch { return ZOOM_DEFAULT; }
    });
    const [inspectorWidth, setInspectorWidthState] = useState<number>(() => loadInspectorWidth());
    const setInspectorWidth = useCallback((next: number): void => {
        const clamped = Math.max(INSPECTOR_WIDTH_MIN, Math.min(INSPECTOR_WIDTH_MAX, next));
        setInspectorWidthState(clamped);
        try {
            window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(clamped));
        } catch { /* storage unavailable */ }
    }, []);

    const isInspectorOpen = Boolean(selectedTaskId);
    const isStackedDashboard = viewportWidth < DASHBOARD_STACKED_BREAKPOINT;
    const showGlobalFiltersButton = selectedTaskId != null;

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

    useEffect(() => {
        try { window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom)); } catch { /* storage unavailable */ }
    }, [zoom]);

    useEffect(() => {
        if (!showGlobalFiltersButton) setIsGlobalFiltersOpen(false);
    }, [showGlobalFiltersButton]);

    const taskTimeline = taskDetail?.timeline ?? [];
    const questionCount = useMemo(() => buildQuestionGroups(taskTimeline).length, [taskTimeline]);
    const todoCount = useMemo(() => buildTodoGroups(taskTimeline).length, [taskTimeline]);
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
        (taskId: string | null): void => { onSelectTaskRoute(taskId); },
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

    const handleSidebarViewChange = useCallback(
        (next: "tasks" | "rules"): void => {
            setSidebarView(next);
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

    const handleSelectSearchTask = useCallback(
        (taskId: string): void => {
            clearSearchQuery("");
            selectConnector(null);
            selectEvent(null);
            selectDashboardTask(taskId);
        },
        [clearSearchQuery, selectConnector, selectDashboardTask, selectEvent]
    );

    const handleSelectSearchEvent = useCallback(
        (taskId: string, eventId: string): void => {
            clearSearchQuery("");
            selectConnector(null);
            selectDashboardTask(taskId);
            selectEvent(eventId);
        },
        [clearSearchQuery, selectConnector, selectDashboardTask, selectEvent]
    );

    const handleToggleFilters = useCallback((): void => {
        if (globalFiltersButtonRef.current) {
            const rect = globalFiltersButtonRef.current.getBoundingClientRect();
            setGlobalFiltersPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        }
        setIsGlobalFiltersOpen((value) => !value);
    }, []);

    const externalFiltersState = useMemo(() => ({
        isOpen: isGlobalFiltersOpen,
        setIsOpen: setIsGlobalFiltersOpen,
        popoverPos: globalFiltersPos,
        setPopoverPos: setGlobalFiltersPos,
        buttonRef: globalFiltersButtonRef,
    }), [isGlobalFiltersOpen, globalFiltersPos]);

    const externalTimelineFilters = useMemo(() => ({
        filters: timelineFilters,
        setFilters: setTimelineFilters,
    }), [timelineFilters]);

    return {
        // State
        selectedTaskId, isConnected, deletingTaskId, deleteErrorTaskId,
        sidebarView, isStackedDashboard, isInspectorOpen, isInspectorCollapsed,
        isSidebarOpen, showGlobalFiltersButton, isGlobalFiltersOpen,
        globalFiltersButtonRef, zoom, inspectorWidth,
        // Data
        tasks, overviewData, taskDetail,
        selectedTaskDisplayTitle, selectedTaskUsesDerivedTitle,
        questionCount, todoCount,
        // Search
        search,
        // Shared filter props
        externalFiltersState,
        externalTimelineFilters,
        // Setters
        setIsInspectorCollapsed, setIsSidebarOpen, setZoom, setInspectorWidth,
        // Handlers
        handleDeleteTask,
        handleSidebarViewChange,
        handleSelectDashboardTask,
        handleSelectSearchTask,
        handleSelectSearchEvent,
        handleToggleFilters,
        selectDashboardTask,
        queryClient,
    };
}

export type DashboardState = ReturnType<typeof useDashboard>;
