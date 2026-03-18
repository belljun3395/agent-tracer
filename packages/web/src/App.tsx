/**
 * 대시보드 루트 컴포넌트.
 * WebSocket 연결, 데이터 페칭, 전역 상태 관리를 담당.
 * UI는 TopBar, TaskList, Timeline, EventInspector에 위임.
 */

import type React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createBookmark,
  createMonitorWebSocket,
  deleteBookmark,
  deleteTask,
  fetchBookmarks,
  fetchOverview,
  fetchSearchResults,
  fetchTaskDetail,
  fetchTasks,
  updateTaskTitle,
  updateTaskStatus
} from "./api.js";
import {
  buildCompactInsight,
  buildModelSummary,
  buildObservabilityStats,
  buildQuestionGroups,
  buildTaskDisplayTitle,
  buildTodoGroups,
  collectExploredFiles,
  filterTimelineEvents
} from "./lib/insights.js";
import { buildTimelineRelations } from "./lib/timeline.js";
import { cn } from "./lib/ui/cn.js";
import { TopBar } from "./components/TopBar.js";
import { TaskList } from "./components/TaskList.js";
import { Timeline } from "./components/Timeline.js";
import { EventInspector } from "./components/EventInspector.js";
import type {
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  SearchResponse,
  TaskDetailResponse,
  TimelineEvent
} from "./types.js";

function isConnectorKeyValid(
  key: string,
  events: readonly TimelineEvent[]
): boolean {
  const parsed = parseConnectorKey(key);
  if (!parsed) return false;

  return events.some((event) => event.id === parsed.sourceEventId)
    && events.some((event) => event.id === parsed.targetEventId);
}

function parseConnectorKey(
  key: string
): { sourceEventId: string; targetEventId: string; relationType?: string } | null {
  const [sourceEventId, targetPart] = key.split("→");
  if (!sourceEventId || !targetPart) return null;

  const [targetEventId, relationType] = targetPart.split(":");
  if (!targetEventId) return null;

  return {
    sourceEventId,
    targetEventId,
    ...(relationType ? { relationType } : {})
  };
}

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_WIDTH_STORAGE_KEY = "agent-tracer.sidebar-width";

export function App(): React.JSX.Element {
  const [overview,        setOverview]        = useState<OverviewResponse | null>(null);
  const [tasks,           setTasks]           = useState<readonly MonitoringTask[]>([]);
  const [bookmarks,       setBookmarks]       = useState<readonly BookmarkRecord[]>([]);
  const [selectedTaskId,  setSelectedTaskId]  = useState<string | null>(
    () => window.location.hash.slice(1) || null
  );
  const [taskDetail,      setTaskDetail]      = useState<TaskDetailResponse | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedConnectorKey, setSelectedConnectorKey] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showRuleGapsOnly, setShowRuleGapsOnly] = useState(false);
  const [searchQuery,      setSearchQuery]      = useState("");
  const [searchResults,    setSearchResults]    = useState<SearchResponse | null>(null);
  const [isSearching,      setIsSearching]      = useState(false);
  const [status,           setStatus]           = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [errorMessage,     setErrorMessage]     = useState<string | null>(null);
  const [deletingTaskId,   setDeletingTaskId]   = useState<string | null>(null);
  const [deleteErrorTaskId,setDeleteErrorTaskId]= useState<string | null>(null);
  const [isConnected,      setIsConnected]      = useState(false);
  const [nowMs,            setNowMs]            = useState(() => Date.now());
  const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [taskTitleError, setTaskTitleError] = useState<string | null>(null);
  const [isSavingTaskTitle, setIsSavingTaskTitle] = useState(false);
  const [isUpdatingTaskStatus, setIsUpdatingTaskStatus] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [taskDisplayTitleCache, setTaskDisplayTitleCache] = useState<
    Readonly<Record<string, { readonly title: string; readonly updatedAt: string }>>
  >({});
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!raw) return SIDEBAR_DEFAULT_WIDTH;

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;

    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, parsed));
  });
  const sidebarResizeRef = useRef<{
    readonly startX: number;
    readonly startWidth: number;
  } | null>(null);
  const selectedTaskIdRef = useRef<string | null>(selectedTaskId);
  const socketRef = useRef<WebSocket | null>(null);

  const refreshOverview = useCallback(async (): Promise<void> => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    setErrorMessage(null);
    try {
      const [nextOverview, nextTasks, nextBookmarks] = await Promise.all([
        fetchOverview(),
        fetchTasks(),
        fetchBookmarks()
      ]);
      setOverview(nextOverview);
      setTasks((prev) => {
        const prevById = new Map(prev.map((t) => [t.id, t]));
        const merged = nextTasks.tasks.map((next) => {
          const existing = prevById.get(next.id);
          return existing && existing.updatedAt === next.updatedAt ? existing : next;
        });
        // 순서・개수가 같고 모든 항목이 동일한 참조면 배열 자체도 유지
        const unchanged = merged.length === prev.length && merged.every((t, i) => t === prev[i]);
        return unchanged ? prev : merged;
      });
      setBookmarks(nextBookmarks.bookmarks);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load monitor data.");
      setStatus("error");
    }
  }, []);

  const refreshTaskDetail = useCallback(async (taskId: string): Promise<void> => {
    try {
      const detail = await fetchTaskDetail(taskId);
      setTaskDetail((prev) => {
        if (!prev || prev.task.id !== detail.task.id) return detail;
        // 태스크 메타 변경 여부
        const sameTask = prev.task.updatedAt === detail.task.updatedAt;
        // 이벤트 배열 병합: 기존 이벤트 객체 참조 재사용
        const prevById = new Map(prev.timeline.map((e) => [e.id, e]));
        const mergedTimeline = detail.timeline.map((next) => prevById.get(next.id) ?? next);
        const timelineUnchanged = mergedTimeline.length === prev.timeline.length
          && mergedTimeline.every((e, i) => e === prev.timeline[i]);
        if (sameTask && timelineUnchanged) return prev;
        return {
          task: sameTask ? prev.task : detail.task,
          timeline: timelineUnchanged ? prev.timeline : mergedTimeline,
        };
      });
      setSelectedConnectorKey((current) =>
        current && isConnectorKeyValid(current, detail.timeline) ? current : null
      );
      setSelectedEventId((current) =>
        current && detail.timeline.some((e) => e.id === current)
          ? current
          : detail.timeline[detail.timeline.length - 1]?.id ?? null
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load task detail.");
      setStatus("error");
    }
  }, []);

  /* initial load */
  useEffect(() => { void refreshOverview(); }, [refreshOverview]);

  /* live clock */
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  /* auto-select first task (hash에 유효한 ID가 있으면 유지) */
  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(null);
      setTaskDetail(null);
      return;
    }
    const hashId = window.location.hash.slice(1);
    if (hashId && tasks.some((t) => t.id === hashId)) return; // hash ID 유효 → 유지
    if (!selectedTaskId || !tasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0]?.id ?? null);
    }
  }, [selectedTaskId, tasks]);

  /* hash ↔ selectedTaskId 동기화 */
  useEffect(() => {
    const next = selectedTaskId ? `#${selectedTaskId}` : "";
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next || window.location.pathname);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    function onHashChange(): void {
      setSelectedTaskId(window.location.hash.slice(1) || null);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  /* load task detail when selection changes */
  useEffect(() => {
    if (!selectedTaskId) return;
    void refreshTaskDetail(selectedTaskId);
  }, [refreshTaskDetail, selectedTaskId]);

  /* reset filters on task change */
  useEffect(() => {
    void selectedTaskId;
    setSelectedRuleId(null);
    setSelectedTag(null);
    setShowRuleGapsOnly(false);
    setIsEditingTaskTitle(false);
    setTaskTitleError(null);
    setIsSavingTaskTitle(false);
  }, [selectedTaskId]);

  const wsRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* websocket with auto-reconnect */
  useEffect(() => {
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect(): void {
      const ws = createMonitorWebSocket();
      socketRef.current = ws;

      ws.onopen = () => { setIsConnected(true); };

      ws.onmessage = () => {
        setIsConnected(true);
        if (wsRefreshTimer.current !== null) clearTimeout(wsRefreshTimer.current);
        wsRefreshTimer.current = setTimeout(() => {
          wsRefreshTimer.current = null;
          void refreshOverview();
          if (selectedTaskIdRef.current) void refreshTaskDetail(selectedTaskIdRef.current);
        }, 200);
      };

      ws.onerror = () => { ws.close(); };

      ws.onclose = () => {
        setIsConnected(false);
        if (socketRef.current === ws) {
          socketRef.current = null;
        }
        if (!destroyed) timer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timer !== null) clearTimeout(timer);
      if (wsRefreshTimer.current !== null) {
        clearTimeout(wsRefreshTimer.current);
        wsRefreshTimer.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [refreshOverview, refreshTaskDetail]);

  const taskTimeline = taskDetail?.timeline ?? [];

  const selectedTaskDisplayTitle = useMemo(
    () => taskDetail?.task ? buildTaskDisplayTitle(taskDetail.task, taskTimeline) : null,
    [taskDetail?.task, taskTimeline]
  );

  const selectedTaskUsesDerivedTitle = Boolean(
    taskDetail?.task
    && selectedTaskDisplayTitle
    && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim()
  );

  useEffect(() => {
    if (!taskDetail?.task || !selectedTaskDisplayTitle) {
      return;
    }

    setTaskDisplayTitleCache((current) => {
      const existing = current[taskDetail.task.id];
      if (
        existing
        && existing.title === selectedTaskDisplayTitle
        && existing.updatedAt === taskDetail.task.updatedAt
      ) {
        return current;
      }

      return {
        ...current,
        [taskDetail.task.id]: {
          title: selectedTaskDisplayTitle,
          updatedAt: taskDetail.task.updatedAt
        }
      };
    });
  }, [selectedTaskDisplayTitle, taskDetail?.task]);

  useEffect(() => {
    const validTaskIds = new Set(tasks.map((task) => task.id));

    setTaskDisplayTitleCache((current) => {
      let changed = false;
      const next: Record<string, { readonly title: string; readonly updatedAt: string }> = {};

      for (const [taskId, entry] of Object.entries(current)) {
        if (!validTaskIds.has(taskId)) {
          changed = true;
          continue;
        }

        next[taskId] = entry;
      }

      return changed ? next : current;
    });
  }, [tasks]);

  const exploredFiles = useMemo(
    () => collectExploredFiles(taskTimeline),
    [taskTimeline]
  );
  const compactInsight = useMemo(
    () => buildCompactInsight(taskTimeline),
    [taskTimeline]
  );
  const observabilityStats = useMemo(
    () => buildObservabilityStats(taskTimeline, exploredFiles.length, compactInsight.occurrences),
    [compactInsight.occurrences, exploredFiles.length, taskTimeline]
  );

  const modelSummary = useMemo(
    () => buildModelSummary(taskTimeline),
    [taskTimeline]
  );
  const questionGroups = useMemo(
    () => buildQuestionGroups(taskTimeline),
    [taskTimeline]
  );
  const todoGroups = useMemo(
    () => buildTodoGroups(taskTimeline),
    [taskTimeline]
  );

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setIsSearching(true);
      void fetchSearchResults(normalizedQuery)
        .then((result) => {
          if (!cancelled) {
            setSearchResults(result);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to search monitor data.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredTimeline = useMemo(
    () => filterTimelineEvents(taskTimeline, {
      laneFilters: { user: true, questions: true, todos: true, background: true, coordination: true, exploration: true, planning: true, implementation: true, rules: true },
      selectedRuleId,
      selectedTag,
      showRuleGapsOnly
    }),
    [selectedRuleId, selectedTag, showRuleGapsOnly, taskTimeline]
  );

  const selectedConnector = useMemo(() => {
    if (!selectedConnectorKey) {
      return null;
    }

    const parsed = parseConnectorKey(selectedConnectorKey);
    if (!parsed) {
      return null;
    }

    const source = taskTimeline.find((event) => event.id === parsed.sourceEventId);
    const target = taskTimeline.find((event) => event.id === parsed.targetEventId);
    if (!source || !target) {
      return null;
    }

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
        relationType: relation?.relationType ?? parsed.relationType,
        label: relation?.label,
        explanation: relation?.explanation,
        isExplicit: relation?.isExplicit ?? parsed.relationType !== "sequence",
        workItemId: relation?.workItemId,
        goalId: relation?.goalId,
        planId: relation?.planId,
        handoffId: relation?.handoffId
      },
      source,
      target
    };
  }, [selectedConnectorKey, taskTimeline]);

  const selectedTaskBookmark = useMemo(
    () => (
      selectedTaskId
        ? bookmarks.find((bookmark) => bookmark.taskId === selectedTaskId && !bookmark.eventId) ?? null
        : null
    ),
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
    ? bookmarks.find((bookmark) => bookmark.eventId === selectedEvent.id) ?? null
    : null;

  useEffect(() => {
    if (isEditingTaskTitle) {
      return;
    }

    setTaskTitleDraft(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
  }, [isEditingTaskTitle, selectedTaskDisplayTitle, taskDetail?.task.title]);

  async function refreshBookmarksOnly(): Promise<void> {
    const response = await fetchBookmarks();
    setBookmarks(response.bookmarks);
  }

  async function handleCreateTaskBookmark(): Promise<void> {
    if (!selectedTaskId) {
      return;
    }

    await createBookmark({
      taskId: selectedTaskId,
      title: selectedTaskDisplayTitle ?? taskDetail?.task.title
    });
    await refreshBookmarksOnly();
  }

  async function handleCreateEventBookmark(): Promise<void> {
    if (!selectedTaskId || !selectedEvent) {
      return;
    }

    await createBookmark({
      taskId: selectedTaskId,
      eventId: selectedEvent.id,
      title: selectedEvent.title
    });
    await refreshBookmarksOnly();
  }

  async function handleDeleteBookmark(bookmarkId: string): Promise<void> {
    await deleteBookmark(bookmarkId);
    await refreshBookmarksOnly();
  }

  function handleSelectBookmark(bookmark: BookmarkRecord): void {
    setSelectedConnectorKey(null);
    setSelectedTaskId(bookmark.taskId);
    setSelectedEventId(bookmark.eventId ?? null);
  }

  function handleSelectSearchTask(taskId: string): void {
    setSelectedConnectorKey(null);
    setSelectedEventId(null);
    setSelectedTaskId(taskId);
  }

  function handleSelectSearchEvent(taskId: string, eventId: string): void {
    setSelectedConnectorKey(null);
    setSelectedTaskId(taskId);
    setSelectedEventId(eventId);
  }

  async function handleDeleteTask(taskId: string): Promise<void> {
    setDeletingTaskId(taskId);
    try {
      await deleteTask(taskId);
      if (selectedTaskId === taskId) { setSelectedTaskId(null); setTaskDetail(null); }
      await refreshOverview();
    } catch {
      setDeleteErrorTaskId(taskId);
      setTimeout(() => setDeleteErrorTaskId(null), 2000);
    } finally {
      setDeletingTaskId(null);
    }
  }

  function startTaskTitleEdit(): void {
    setTaskTitleDraft(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
    setTaskTitleError(null);
    setIsEditingTaskTitle(true);
  }

  function cancelTaskTitleEdit(): void {
    setTaskTitleDraft(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
    setTaskTitleError(null);
    setIsEditingTaskTitle(false);
  }

  async function handleTaskStatusChange(status: MonitoringTask["status"]): Promise<void> {
    if (!taskDetail?.task) return;

    setIsUpdatingTaskStatus(true);
    try {
      const updatedTask = await updateTaskStatus(taskDetail.task.id, status);
      setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
      setTaskDetail((current) => (
        current && current.task.id === updatedTask.id
          ? { ...current, task: updatedTask }
          : current
      ));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setIsUpdatingTaskStatus(false);
    }
  }

  async function handleTaskTitleSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!taskDetail?.task) {
      return;
    }

    const nextTitle = taskTitleDraft.trim();
    if (!nextTitle) {
      setTaskTitleError("Title cannot be empty.");
      return;
    }

    if (nextTitle === taskDetail.task.title.trim()) {
      setTaskTitleError(null);
      setIsEditingTaskTitle(false);
      return;
    }

    setIsSavingTaskTitle(true);
    setTaskTitleError(null);

    try {
      const updatedTask = await updateTaskTitle(taskDetail.task.id, nextTitle);
      setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
      setTaskDetail((current) => (
        current && current.task.id === updatedTask.id
          ? { ...current, task: updatedTask }
          : current
      ));
      setIsEditingTaskTitle(false);
    } catch (err) {
      setTaskTitleError(err instanceof Error ? err.message : "Failed to save task title.");
    } finally {
      setIsSavingTaskTitle(false);
    }
  }

  const onSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isSidebarCollapsed) return;

    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };

    const onMove = (moveEvent: PointerEvent): void => {
      const current = sidebarResizeRef.current;
      if (!current) return;

      const delta = moveEvent.clientX - current.startX;
      const nextWidth = Math.round(current.startWidth + delta);
      const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, nextWidth));
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

  const dashboardStyle = useMemo(
    () => ({ "--sidebar-width": `${sidebarWidth}px` }) as React.CSSProperties,
    [sidebarWidth]
  );

  const dashboardColumns = isSidebarCollapsed
    ? (isInspectorCollapsed
      ? "!grid-cols-[44px_minmax(0,1fr)_44px]"
      : "!grid-cols-[44px_minmax(0,1fr)_clamp(300px,26vw,480px)]")
    : (isInspectorCollapsed
      ? "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_44px]"
      : "!grid-cols-[var(--sidebar-width)_minmax(0,1fr)_clamp(300px,26vw,480px)]");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--bg)]">

      <TopBar
        overview={overview}
        isConnected={isConnected}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        onSearchQueryChange={setSearchQuery}
        onSelectSearchTask={handleSelectSearchTask}
        onSelectSearchEvent={handleSelectSearchEvent}
        onSelectSearchBookmark={(bookmark) => {
          const target = bookmarks.find((item) => item.id === bookmark.bookmarkId);
          if (target) {
            handleSelectBookmark(target);
            return;
          }

          if (bookmark.eventId) {
            handleSelectSearchEvent(bookmark.taskId, bookmark.eventId);
          } else {
            handleSelectSearchTask(bookmark.taskId);
          }
        }}
        onRefresh={() => void refreshOverview()}
      />

      <main
        className={cn(
          "dashboard-shell grid flex-1 min-h-0 gap-3 overflow-hidden p-2.5 transition-[grid-template-columns] duration-200",
          dashboardColumns,
          isSidebarCollapsed && "sidebar-collapsed",
          isInspectorCollapsed && "inspector-collapsed"
        )}
        style={dashboardStyle}
      >

        <div className="sidebar-slot relative flex min-h-0 min-w-0 flex-col overflow-hidden">
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
            onSelectTask={(id) => setSelectedTaskId(id)}
            onSelectBookmark={handleSelectBookmark}
            onDeleteBookmark={(bookmarkId) => {
              void handleDeleteBookmark(bookmarkId).catch((err) => {
                setErrorMessage(err instanceof Error ? err.message : "Failed to delete bookmark.");
              });
            }}
            onSaveTaskBookmark={() => {
              void handleCreateTaskBookmark().catch((err) => {
                setErrorMessage(err instanceof Error ? err.message : "Failed to save task bookmark.");
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

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          {/* error banner */}
          {status === "error" && (
            <div className="error-banner flex-shrink-0 border-b border-[#fca5a5] bg-[var(--err-bg)] px-3.5 py-2 text-[0.82rem] text-[var(--err)]">
              <strong>Monitor unavailable</strong>
              <p className="m-0">{errorMessage}</p>
            </div>
          )}

          <Timeline
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
              setSelectedConnectorKey(null);
              setSelectedEventId(id);
            }}
            onSelectConnector={(key) => {
              setSelectedConnectorKey(key);
              setSelectedEventId(null);
            }}
            onStartEditTitle={startTaskTitleEdit}
            onCancelEditTitle={cancelTaskTitleEdit}
            onSubmitTitle={(e) => void handleTaskTitleSubmit(e)}
            onTitleDraftChange={(val) => setTaskTitleDraft(val)}
            onClearFilters={() => {
              setSelectedRuleId(null);
              setSelectedTag(null);
              setShowRuleGapsOnly(false);
            }}
            onToggleRuleGap={(show) => setShowRuleGapsOnly(show)}
            onClearRuleId={() => setSelectedRuleId(null)}
            onClearTag={() => setSelectedTag(null)}
            onChangeTaskStatus={(s) => void handleTaskStatusChange(s)}
          />
        </section>

        <EventInspector
          taskDetail={taskDetail}
          overview={overview}
          selectedEvent={selectedEvent}
          selectedConnector={selectedConnector}
          selectedEventDisplayTitle={selectedEventDisplayTitle}
          selectedTaskBookmark={selectedTaskBookmark}
          selectedEventBookmark={selectedEventBookmark}
          selectedTag={selectedTag}
          selectedRuleId={selectedRuleId}
          showRuleGapsOnly={showRuleGapsOnly}
          taskModelSummary={modelSummary}
          isCollapsed={isInspectorCollapsed}
          onToggleCollapse={() => setIsInspectorCollapsed((v) => !v)}
          onCreateTaskBookmark={() => {
            void handleCreateTaskBookmark().catch((err) => {
              setErrorMessage(err instanceof Error ? err.message : "Failed to save task bookmark.");
            });
          }}
          onCreateEventBookmark={() => {
            void handleCreateEventBookmark().catch((err) => {
              setErrorMessage(err instanceof Error ? err.message : "Failed to save event bookmark.");
            });
          }}
          onSelectTag={(tag) => setSelectedTag(tag)}
          onSelectRule={(ruleId) => {
            setShowRuleGapsOnly(false);
            setSelectedRuleId(ruleId);
          }}
          onToggleRuleGaps={() => {
            setSelectedRuleId(null);
            setShowRuleGapsOnly((current) => !current);
          }}
        />

      </main>
    </div>
  );
}
