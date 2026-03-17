/**
 * 대시보드 루트 컴포넌트.
 * WebSocket 연결, 데이터 페칭, 전역 상태 관리를 담당.
 * UI는 TopBar, TaskList, Timeline, EventInspector에 위임.
 */

import type React from "react";
import {
  useEffect,
  useMemo,
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

export function App(): React.JSX.Element {
  const [overview,        setOverview]        = useState<OverviewResponse | null>(null);
  const [tasks,           setTasks]           = useState<readonly MonitoringTask[]>([]);
  const [selectedTaskId,  setSelectedTaskId]  = useState<string | null>(null);
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

  /* initial load */
  useEffect(() => { void refreshOverview(); }, []);

  /* live clock */
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  /* auto-select first task */
  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId(null);
      setTaskDetail(null);
      return;
    }
    if (!selectedTaskId || !tasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0]?.id ?? null);
    }
  }, [selectedTaskId, tasks]);

  /* load task detail when selection changes */
  useEffect(() => {
    if (!selectedTaskId) return;
    void refreshTaskDetail(selectedTaskId);
  }, [selectedTaskId]);

  /* reset filters on task change */
  useEffect(() => {
    setSelectedRuleId(null);
    setSelectedTag(null);
    setShowRuleGapsOnly(false);
    setIsEditingTaskTitle(false);
    setTaskTitleError(null);
    setIsSavingTaskTitle(false);
  }, [selectedTaskId]);

  /* websocket with auto-reconnect */
  useEffect(() => {
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect(): void {
      const ws = createMonitorWebSocket();

      ws.onopen = () => { setIsConnected(true); };

      ws.onmessage = () => {
        setIsConnected(true);
        void refreshOverview();
        if (selectedTaskId) void refreshTaskDetail(selectedTaskId);
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
  }, [selectedTaskId]);

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
      laneFilters: { user: true, questions: true, todos: true, thoughts: true, exploration: true, planning: true, implementation: true, rules: true },
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

  /* data helpers */
  async function refreshOverview(): Promise<void> {
    setStatus((s) => (s === "ready" ? s : "loading"));
    setErrorMessage(null);
    try {
      const [nextOverview, nextTasks] = await Promise.all([fetchOverview(), fetchTasks()]);
      setOverview(nextOverview);
      setTasks(nextTasks.tasks);
      setStatus("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load monitor data.");
      setStatus("error");
    }
  }

  async function refreshTaskDetail(taskId: string): Promise<void> {
    try {
      const detail = await fetchTaskDetail(taskId);
      setTaskDetail(detail);
      setSelectedConnectorKey((current) =>
        current && isConnectorKeyValid(current, detail.timeline) ? current : null
      );
      setSelectedEventId((current) =>
        current && detail.timeline.some((e) => e.id === current)
          ? current
          : detail.timeline[0]?.id ?? null
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load task detail.");
      setStatus("error");
    }
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

  return (
    <div className="app-shell">

      <TopBar
        overview={overview}
        isConnected={isConnected}
        onRefresh={() => void refreshOverview()}
      />

      <main className="dashboard-shell">

        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          taskDetail={taskDetail}
          selectedTaskQuestionCount={questionGroups.length}
          selectedTaskTodoCount={todoGroups.length}
          deletingTaskId={deletingTaskId}
          deleteErrorTaskId={deleteErrorTaskId}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onDeleteTask={(id) => void handleDeleteTask(id)}
          onRefresh={() => void refreshOverview()}
        />

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
