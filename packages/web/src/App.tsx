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
  createMonitorWebSocket,
  deleteTask,
  fetchOverview,
  fetchTaskDetail,
  fetchTasks,
  updateTaskTitle
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
import { TopBar } from "./components/TopBar.js";
import { TaskList } from "./components/TaskList.js";
import { Timeline } from "./components/Timeline.js";
import { EventInspector } from "./components/EventInspector.js";
import type {
  MonitoringTask,
  OverviewResponse,
  TaskDetailResponse,
  TimelineEvent
} from "./types.js";

function isConnectorKeyValid(
  key: string,
  events: readonly TimelineEvent[]
): boolean {
  const [sourceId, targetId] = key.split("→");
  if (!sourceId || !targetId) return false;

  return events.some((event) => event.id === sourceId)
    && events.some((event) => event.id === targetId);
}

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 460;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_WIDTH_STORAGE_KEY = "agent-tracer.sidebar-width";

export function App(): React.JSX.Element {
  const [overview,        setOverview]        = useState<OverviewResponse | null>(null);
  const [tasks,           setTasks]           = useState<readonly MonitoringTask[]>([]);
  const [selectedTaskId,  setSelectedTaskId]  = useState<string | null>(
    () => window.location.hash.slice(1) || null
  );
  const [taskDetail,      setTaskDetail]      = useState<TaskDetailResponse | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedConnectorKey, setSelectedConnectorKey] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showRuleGapsOnly, setShowRuleGapsOnly] = useState(false);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
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

  const refreshOverview = useCallback(async (): Promise<void> => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    setErrorMessage(null);
    try {
      const [nextOverview, nextTasks] = await Promise.all([fetchOverview(), fetchTasks()]);
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

      ws.onopen = () => { setIsConnected(true); };

      ws.onmessage = () => {
        setIsConnected(true);
        if (wsRefreshTimer.current !== null) clearTimeout(wsRefreshTimer.current);
        wsRefreshTimer.current = setTimeout(() => {
          wsRefreshTimer.current = null;
          void refreshOverview();
          if (selectedTaskId) void refreshTaskDetail(selectedTaskId);
        }, 200);
      };

      ws.onerror = () => { ws.close(); };

      ws.onclose = () => {
        setIsConnected(false);
        if (!destroyed) timer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [refreshOverview, refreshTaskDetail, selectedTaskId]);

  const taskTimeline = taskDetail?.timeline ?? [];

  const selectedTaskDisplayTitle = useMemo(
    () => taskDetail?.task ? buildTaskDisplayTitle(taskDetail.task, taskTimeline) : null,
    [taskDetail?.task, taskTimeline]
  );

  const [taskTitleCache, setTaskTitleCache] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (selectedTaskId && selectedTaskDisplayTitle) {
      setTaskTitleCache((prev) => {
        const next = new Map(prev);
        next.set(selectedTaskId, selectedTaskDisplayTitle);
        return next;
      });
    }
  }, [selectedTaskId, selectedTaskDisplayTitle]);

  const selectedTaskUsesDerivedTitle = Boolean(
    taskDetail?.task
    && selectedTaskDisplayTitle
    && selectedTaskDisplayTitle.trim() !== taskDetail.task.title.trim()
  );

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

  const filteredTimeline = useMemo(
    () => filterTimelineEvents(taskTimeline, {
      laneFilters: { user: true, questions: true, todos: true, background: true, exploration: true, planning: true, implementation: true, rules: true },
      selectedRuleId,
      selectedTag,
      showRuleGapsOnly
    }),
    [selectedRuleId, selectedTag, showRuleGapsOnly, taskTimeline]
  );

  const selectedEvent = filteredTimeline.find((e) => e.id === selectedEventId) ?? filteredTimeline[0] ?? null;
  const selectedEventDisplayTitle = selectedEvent
    ? selectedEvent.kind === "task.start"
      ? selectedTaskDisplayTitle ?? selectedEvent.title
      : selectedEvent.title
    : null;

  useEffect(() => {
    if (isEditingTaskTitle) {
      return;
    }

    setTaskTitleDraft(selectedTaskDisplayTitle ?? taskDetail?.task.title ?? "");
  }, [isEditingTaskTitle, selectedTaskDisplayTitle, taskDetail?.task.title]);

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

  return (
    <div className="app-shell">

      <TopBar
        overview={overview}
        isConnected={isConnected}
        onRefresh={() => void refreshOverview()}
      />

      <main
        className={`dashboard-shell${isSidebarCollapsed ? " sidebar-collapsed" : ""}${isInspectorCollapsed ? " inspector-collapsed" : ""}`}
        style={dashboardStyle}
      >

        <div className="sidebar-slot">
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            taskDetail={taskDetail}
            selectedTaskDisplayTitle={selectedTaskDisplayTitle}
            taskTitleCache={taskTitleCache}
            selectedTaskQuestionCount={questionGroups.length}
            selectedTaskTodoCount={todoGroups.length}
            deletingTaskId={deletingTaskId}
            deleteErrorTaskId={deleteErrorTaskId}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
            onSelectTask={(id) => setSelectedTaskId(id)}
            onDeleteTask={(id) => void handleDeleteTask(id)}
            onRefresh={() => void refreshOverview()}
          />
          {!isSidebarCollapsed && (
            <div
              aria-label="Resize task sidebar"
              aria-orientation="vertical"
              className="sidebar-resizer"
              onPointerDown={onSidebarResizeStart}
              role="separator"
            />
          )}
        </div>

        <section className="main-panel">
          {/* error banner */}
          {status === "error" && (
            <div className="error-banner">
              <strong>Monitor unavailable</strong>
              <p style={{ margin: 0 }}>{errorMessage}</p>
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
          />
        </section>

        <EventInspector
          taskDetail={taskDetail}
          overview={overview}
          selectedEvent={selectedEvent}
          selectedConnector={null}
          selectedEventDisplayTitle={selectedEventDisplayTitle}
          selectedTag={selectedTag}
          selectedRuleId={selectedRuleId}
          showRuleGapsOnly={showRuleGapsOnly}
          taskModelSummary={modelSummary}
          isCollapsed={isInspectorCollapsed}
          onToggleCollapse={() => setIsInspectorCollapsed((v) => !v)}
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
