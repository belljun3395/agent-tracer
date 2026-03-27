/**
 * 전역 모니터 상태 관리.
 * useReducer + Context 패턴으로 App 전역 상태를 집중 관리.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch
} from "react";

import {
  createBookmark,
  deleteBookmark,
  deleteTask,
  fetchBookmarks,
  fetchOverview,
  fetchTaskDetail,
  fetchTasks,
  updateTaskStatus,
  updateTaskTitle
} from "../api.js";
import { buildTaskDisplayTitle } from "../lib/insights.js";
import type {
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  SearchResponse,
  TaskDetailResponse,
  TimelineEvent
} from "../types.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface MonitorState {
  readonly tasks: readonly MonitoringTask[];
  readonly bookmarks: readonly BookmarkRecord[];
  readonly overview: OverviewResponse | null;
  readonly selectedTaskId: string | null;
  readonly selectedEventId: string | null;
  readonly selectedConnectorKey: string | null;
  readonly selectedRuleId: string | null;
  readonly selectedTag: string | null;
  readonly showRuleGapsOnly: boolean;
  readonly taskDetail: TaskDetailResponse | null;
  readonly isConnected: boolean;
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly errorMessage: string | null;
  readonly deletingTaskId: string | null;
  readonly deleteErrorTaskId: string | null;
  readonly nowMs: number;
  readonly isEditingTaskTitle: boolean;
  readonly taskTitleDraft: string;
  readonly taskTitleError: string | null;
  readonly isSavingTaskTitle: boolean;
  readonly isUpdatingTaskStatus: boolean;
  readonly taskDisplayTitleCache: Readonly<
    Record<string, { readonly title: string; readonly updatedAt: string }>
  >;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type MonitorAction =
  | { type: "SET_OVERVIEW"; overview: OverviewResponse }
  | { type: "SET_TASKS"; tasks: readonly MonitoringTask[] }
  | { type: "SET_BOOKMARKS"; bookmarks: readonly BookmarkRecord[] }
  | { type: "SELECT_TASK"; taskId: string | null }
  | { type: "SELECT_EVENT"; eventId: string | null }
  | { type: "SELECT_CONNECTOR"; connectorKey: string | null }
  | { type: "SELECT_RULE"; ruleId: string | null }
  | { type: "SELECT_TAG"; tag: string | null }
  | { type: "SET_SHOW_RULE_GAPS_ONLY"; show: boolean }
  | { type: "SET_TASK_DETAIL"; detail: TaskDetailResponse | null }
  | { type: "SET_CONNECTED"; isConnected: boolean }
  | { type: "SET_STATUS"; status: MonitorState["status"]; errorMessage?: string | null }
  | { type: "SET_DELETING_TASK_ID"; taskId: string | null }
  | { type: "SET_DELETE_ERROR_TASK_ID"; taskId: string | null }
  | { type: "SET_NOW_MS"; nowMs: number }
  | { type: "SET_EDITING_TASK_TITLE"; isEditing: boolean }
  | { type: "SET_TASK_TITLE_DRAFT"; draft: string }
  | { type: "SET_TASK_TITLE_ERROR"; error: string | null }
  | { type: "SET_SAVING_TASK_TITLE"; isSaving: boolean }
  | { type: "SET_UPDATING_TASK_STATUS"; isUpdating: boolean }
  | { type: "PATCH_TASK_DISPLAY_TITLE_CACHE"; taskId: string; title: string; updatedAt: string }
  | { type: "PRUNE_TASK_DISPLAY_TITLE_CACHE"; validTaskIds: ReadonlySet<string> }
  | { type: "RESET_TASK_FILTERS" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState: MonitorState = {
  tasks: [],
  bookmarks: [],
  overview: null,
  selectedTaskId: window.location.hash.slice(1) || null,
  selectedEventId: null,
  selectedConnectorKey: null,
  selectedRuleId: null,
  selectedTag: null,
  showRuleGapsOnly: false,
  taskDetail: null,
  isConnected: false,
  status: "idle",
  errorMessage: null,
  deletingTaskId: null,
  deleteErrorTaskId: null,
  nowMs: Date.now(),
  isEditingTaskTitle: false,
  taskTitleDraft: "",
  taskTitleError: null,
  isSavingTaskTitle: false,
  isUpdatingTaskStatus: false,
  taskDisplayTitleCache: {}
};

function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  switch (action.type) {
    case "SET_OVERVIEW":
      return { ...state, overview: action.overview };

    case "SET_TASKS":
      return { ...state, tasks: action.tasks };

    case "SET_BOOKMARKS":
      return { ...state, bookmarks: action.bookmarks };

    case "SELECT_TASK":
      return { ...state, selectedTaskId: action.taskId };

    case "SELECT_EVENT":
      return { ...state, selectedEventId: action.eventId };

    case "SELECT_CONNECTOR":
      return { ...state, selectedConnectorKey: action.connectorKey };

    case "SELECT_RULE":
      return { ...state, selectedRuleId: action.ruleId };

    case "SELECT_TAG":
      return { ...state, selectedTag: action.tag };

    case "SET_SHOW_RULE_GAPS_ONLY":
      return { ...state, showRuleGapsOnly: action.show };

    case "SET_TASK_DETAIL":
      return { ...state, taskDetail: action.detail };

    case "SET_CONNECTED":
      return { ...state, isConnected: action.isConnected };

    case "SET_STATUS":
      return {
        ...state,
        status: action.status,
        errorMessage: action.errorMessage !== undefined ? action.errorMessage : state.errorMessage
      };

    case "SET_DELETING_TASK_ID":
      return { ...state, deletingTaskId: action.taskId };

    case "SET_DELETE_ERROR_TASK_ID":
      return { ...state, deleteErrorTaskId: action.taskId };

    case "SET_NOW_MS":
      return { ...state, nowMs: action.nowMs };

    case "SET_EDITING_TASK_TITLE":
      return { ...state, isEditingTaskTitle: action.isEditing };

    case "SET_TASK_TITLE_DRAFT":
      return { ...state, taskTitleDraft: action.draft };

    case "SET_TASK_TITLE_ERROR":
      return { ...state, taskTitleError: action.error };

    case "SET_SAVING_TASK_TITLE":
      return { ...state, isSavingTaskTitle: action.isSaving };

    case "SET_UPDATING_TASK_STATUS":
      return { ...state, isUpdatingTaskStatus: action.isUpdating };

    case "PATCH_TASK_DISPLAY_TITLE_CACHE": {
      const existing = state.taskDisplayTitleCache[action.taskId];
      if (existing?.title === action.title && existing.updatedAt === action.updatedAt) {
        return state;
      }
      return {
        ...state,
        taskDisplayTitleCache: {
          ...state.taskDisplayTitleCache,
          [action.taskId]: { title: action.title, updatedAt: action.updatedAt }
        }
      };
    }

    case "PRUNE_TASK_DISPLAY_TITLE_CACHE": {
      let changed = false;
      const next: Record<string, { readonly title: string; readonly updatedAt: string }> = {};
      for (const [taskId, entry] of Object.entries(state.taskDisplayTitleCache)) {
        if (!action.validTaskIds.has(taskId)) {
          changed = true;
          continue;
        }
        next[taskId] = entry;
      }
      return changed ? { ...state, taskDisplayTitleCache: next } : state;
    }

    case "RESET_TASK_FILTERS":
      return {
        ...state,
        selectedRuleId: null,
        selectedTag: null,
        showRuleGapsOnly: false,
        isEditingTaskTitle: false,
        taskTitleError: null,
        isSavingTaskTitle: false
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface MonitorContextValue {
  readonly state: MonitorState;
  readonly dispatch: Dispatch<MonitorAction>;
  readonly refreshOverview: () => Promise<void>;
  readonly refreshTaskDetail: (taskId: string) => Promise<void>;
  readonly refreshBookmarksOnly: () => Promise<void>;
  readonly handleDeleteTask: (taskId: string) => Promise<void>;
  readonly handleCreateTaskBookmark: () => Promise<void>;
  readonly handleCreateEventBookmark: (eventId: string, eventTitle: string) => Promise<void>;
  readonly handleDeleteBookmark: (bookmarkId: string) => Promise<void>;
  readonly handleTaskStatusChange: (status: MonitoringTask["status"]) => Promise<void>;
  readonly handleTaskTitleSubmit: (
    event: React.SyntheticEvent<HTMLFormElement>,
    nextTitle: string
  ) => Promise<void>;
}

const MonitorContext = createContext<MonitorContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helper: merge timeline arrays with reference reuse
// ---------------------------------------------------------------------------

function mergeTimeline(
  prev: readonly TimelineEvent[],
  next: readonly TimelineEvent[]
): readonly TimelineEvent[] {
  const prevById = new Map(prev.map((e) => [e.id, e]));
  const merged = next.map((e) => prevById.get(e.id) ?? e);
  const unchanged =
    merged.length === prev.length && merged.every((e, i) => e === prev[i]);
  return unchanged ? prev : merged;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MonitorProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(monitorReducer, initialState);

  const stateRef = useRef(state);
  stateRef.current = state;

  // ------------------------------------------------------------------
  // refreshOverview
  // ------------------------------------------------------------------
  const refreshOverview = useCallback(async (): Promise<void> => {
    dispatch({
      type: "SET_STATUS",
      status: stateRef.current.status === "ready" ? "ready" : "loading",
      errorMessage: null
    });
    try {
      const [nextOverview, nextTasks, nextBookmarks] = await Promise.all([
        fetchOverview(),
        fetchTasks(),
        fetchBookmarks()
      ]);
      dispatch({ type: "SET_OVERVIEW", overview: nextOverview });
      dispatch({
        type: "SET_TASKS",
        tasks: (() => {
          const prev = stateRef.current.tasks;
          const prevById = new Map(prev.map((t) => [t.id, t]));
          const merged = nextTasks.tasks.map((next) => {
            const existing = prevById.get(next.id);
            return existing && existing.updatedAt === next.updatedAt ? existing : next;
          });
          const unchanged =
            merged.length === prev.length && merged.every((t, i) => t === prev[i]);
          return unchanged ? prev : merged;
        })()
      });
      dispatch({ type: "SET_BOOKMARKS", bookmarks: nextBookmarks.bookmarks });
      dispatch({ type: "SET_STATUS", status: "ready" });
    } catch (err) {
      dispatch({
        type: "SET_STATUS",
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Failed to load monitor data."
      });
    }
  }, []);

  // ------------------------------------------------------------------
  // refreshTaskDetail
  // ------------------------------------------------------------------
  const refreshTaskDetail = useCallback(async (taskId: string): Promise<void> => {
    try {
      const detail = await fetchTaskDetail(taskId);
      dispatch({
        type: "SET_TASK_DETAIL",
        detail: (() => {
          const prev = stateRef.current.taskDetail;
          if (!prev || prev.task.id !== detail.task.id) return detail;
          const sameTask = prev.task.updatedAt === detail.task.updatedAt;
          const mergedTimeline = mergeTimeline(prev.timeline, detail.timeline);
          const timelineUnchanged = mergedTimeline === prev.timeline;
          if (sameTask && timelineUnchanged) return prev;
          return {
            task: sameTask ? prev.task : detail.task,
            timeline: mergedTimeline
          };
        })()
      });

      // connector key 유효성 검사
      const currentConnector = stateRef.current.selectedConnectorKey;
      if (currentConnector) {
        const valid = isConnectorKeyValidForTimeline(currentConnector, detail.timeline);
        if (!valid) {
          dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
        }
      }

      // event selection: 유효하면 유지, 없으면 마지막 이벤트로
      dispatch({
        type: "SELECT_EVENT",
        eventId: (() => {
          const current = stateRef.current.selectedEventId;
          if (current && detail.timeline.some((e) => e.id === current)) return current;
          return detail.timeline[detail.timeline.length - 1]?.id ?? null;
        })()
      });
    } catch (err) {
      dispatch({
        type: "SET_STATUS",
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Failed to load task detail."
      });
    }
  }, []);

  // ------------------------------------------------------------------
  // refreshBookmarksOnly
  // ------------------------------------------------------------------
  const refreshBookmarksOnly = useCallback(async (): Promise<void> => {
    const response = await fetchBookmarks();
    dispatch({ type: "SET_BOOKMARKS", bookmarks: response.bookmarks });
  }, []);

  // ------------------------------------------------------------------
  // handleDeleteTask
  // ------------------------------------------------------------------
  const handleDeleteTask = useCallback(async (taskId: string): Promise<void> => {
    dispatch({ type: "SET_DELETING_TASK_ID", taskId });
    try {
      await deleteTask(taskId);
      if (stateRef.current.selectedTaskId === taskId) {
        dispatch({ type: "SELECT_TASK", taskId: null });
        dispatch({ type: "SET_TASK_DETAIL", detail: null });
      }
      await refreshOverview();
    } catch {
      dispatch({ type: "SET_DELETE_ERROR_TASK_ID", taskId });
      setTimeout(() => dispatch({ type: "SET_DELETE_ERROR_TASK_ID", taskId: null }), 2000);
    } finally {
      dispatch({ type: "SET_DELETING_TASK_ID", taskId: null });
    }
  }, [refreshOverview]);

  // ------------------------------------------------------------------
  // handleCreateTaskBookmark
  // ------------------------------------------------------------------
  const handleCreateTaskBookmark = useCallback(async (): Promise<void> => {
    const { selectedTaskId, taskDetail, taskDisplayTitleCache } = stateRef.current;
    if (!selectedTaskId) return;
    const displayTitle = taskDetail?.task
      ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title)
      : undefined;
    await createBookmark(displayTitle !== undefined
      ? { taskId: selectedTaskId, title: displayTitle }
      : { taskId: selectedTaskId });
    await refreshBookmarksOnly();
  }, [refreshBookmarksOnly]);

  // ------------------------------------------------------------------
  // handleCreateEventBookmark
  // ------------------------------------------------------------------
  const handleCreateEventBookmark = useCallback(
    async (eventId: string, eventTitle: string): Promise<void> => {
      const { selectedTaskId } = stateRef.current;
      if (!selectedTaskId) return;
      await createBookmark({ taskId: selectedTaskId, eventId, title: eventTitle });
      await refreshBookmarksOnly();
    },
    [refreshBookmarksOnly]
  );

  // ------------------------------------------------------------------
  // handleDeleteBookmark
  // ------------------------------------------------------------------
  const handleDeleteBookmark = useCallback(async (bookmarkId: string): Promise<void> => {
    await deleteBookmark(bookmarkId);
    await refreshBookmarksOnly();
  }, [refreshBookmarksOnly]);

  // ------------------------------------------------------------------
  // handleTaskStatusChange
  // ------------------------------------------------------------------
  const handleTaskStatusChange = useCallback(
    async (status: MonitoringTask["status"]): Promise<void> => {
      const { taskDetail } = stateRef.current;
      if (!taskDetail?.task) return;
      dispatch({ type: "SET_UPDATING_TASK_STATUS", isUpdating: true });
      try {
        const updatedTask = await updateTaskStatus(taskDetail.task.id, status);
        dispatch({
          type: "SET_TASKS",
          tasks: stateRef.current.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        });
        dispatch({
          type: "SET_TASK_DETAIL",
          detail:
            stateRef.current.taskDetail?.task.id === updatedTask.id
              ? { ...stateRef.current.taskDetail, task: updatedTask }
              : stateRef.current.taskDetail
        });
      } catch (err) {
        dispatch({
          type: "SET_STATUS",
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Failed to update task status."
        });
      } finally {
        dispatch({ type: "SET_UPDATING_TASK_STATUS", isUpdating: false });
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // handleTaskTitleSubmit
  // ------------------------------------------------------------------
  const handleTaskTitleSubmit = useCallback(
    async (
      event: React.SyntheticEvent<HTMLFormElement>,
      nextTitle: string
    ): Promise<void> => {
      event.preventDefault();
      const { taskDetail } = stateRef.current;
      if (!taskDetail?.task) return;

      const trimmed = nextTitle.trim();
      if (!trimmed) {
        dispatch({ type: "SET_TASK_TITLE_ERROR", error: "Title cannot be empty." });
        return;
      }

      if (trimmed === taskDetail.task.title.trim()) {
        dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });
        dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
        return;
      }

      dispatch({ type: "SET_SAVING_TASK_TITLE", isSaving: true });
      dispatch({ type: "SET_TASK_TITLE_ERROR", error: null });

      try {
        const updatedTask = await updateTaskTitle(taskDetail.task.id, trimmed);
        dispatch({
          type: "SET_TASKS",
          tasks: stateRef.current.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        });
        dispatch({
          type: "SET_TASK_DETAIL",
          detail:
            stateRef.current.taskDetail?.task.id === updatedTask.id
              ? { ...stateRef.current.taskDetail, task: updatedTask }
              : stateRef.current.taskDetail
        });
        dispatch({ type: "SET_EDITING_TASK_TITLE", isEditing: false });
      } catch (err) {
        dispatch({
          type: "SET_TASK_TITLE_ERROR",
          error: err instanceof Error ? err.message : "Failed to save task title."
        });
      } finally {
        dispatch({ type: "SET_SAVING_TASK_TITLE", isSaving: false });
      }
    },
    []
  );

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  // initial load
  useEffect(() => { void refreshOverview(); }, [refreshOverview]);

  // live clock (10초마다 갱신)
  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "SET_NOW_MS", nowMs: Date.now() }), 10_000);
    return () => clearInterval(timer);
  }, []);

  // auto-select first task
  useEffect(() => {
    const { tasks, selectedTaskId } = state;
    if (tasks.length === 0) {
      dispatch({ type: "SELECT_TASK", taskId: null });
      dispatch({ type: "SET_TASK_DETAIL", detail: null });
      return;
    }
    const hashId = window.location.hash.slice(1);
    if (hashId && tasks.some((t) => t.id === hashId)) return;
    if (!selectedTaskId || !tasks.some((t) => t.id === selectedTaskId)) {
      dispatch({ type: "SELECT_TASK", taskId: tasks[0]?.id ?? null });
    }
  }, [state.tasks]);

  // hash ↔ selectedTaskId 동기화
  useEffect(() => {
    const next = state.selectedTaskId ? `#${state.selectedTaskId}` : "";
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next || window.location.pathname);
    }
  }, [state.selectedTaskId]);

  // hashchange 이벤트
  useEffect(() => {
    function onHashChange(): void {
      dispatch({ type: "SELECT_TASK", taskId: window.location.hash.slice(1) || null });
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // task 변경 시 task detail 로드
  useEffect(() => {
    if (!state.selectedTaskId) return;
    void refreshTaskDetail(state.selectedTaskId);
  }, [refreshTaskDetail, state.selectedTaskId]);

  // task 변경 시 필터 초기화
  useEffect(() => {
    dispatch({ type: "RESET_TASK_FILTERS" });
  }, [state.selectedTaskId]);

  // taskDisplayTitleCache: 선택된 태스크 표시 제목 갱신
  useEffect(() => {
    const { taskDetail } = state;
    if (!taskDetail?.task) return;
    const displayTitle = buildTaskDisplayTitle(taskDetail.task, taskDetail.timeline);
    if (!displayTitle) return;
    dispatch({
      type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
      taskId: taskDetail.task.id,
      title: displayTitle,
      updatedAt: taskDetail.task.updatedAt
    });
  }, [state.taskDetail]);

  // taskDisplayTitleCache: 삭제된 태스크 항목 제거
  useEffect(() => {
    const validTaskIds = new Set(state.tasks.map((t) => t.id));
    dispatch({ type: "PRUNE_TASK_DISPLAY_TITLE_CACHE", validTaskIds });
  }, [state.tasks]);

  // isEditingTaskTitle 해제 시 draft 동기화
  useEffect(() => {
    if (state.isEditingTaskTitle) return;
    const { taskDetail, taskDisplayTitleCache } = state;
    if (!taskDetail?.task) return;
    const displayTitle = taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title;
    dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: displayTitle });
  }, [state.isEditingTaskTitle, state.taskDetail]);

  const value = useMemo<MonitorContextValue>(
    () => ({
      state,
      dispatch,
      refreshOverview,
      refreshTaskDetail,
      refreshBookmarksOnly,
      handleDeleteTask,
      handleCreateTaskBookmark,
      handleCreateEventBookmark,
      handleDeleteBookmark,
      handleTaskStatusChange,
      handleTaskTitleSubmit
    }),
    // dispatch는 안정적이므로 의존성에서 제외
    [
      state,
      refreshOverview,
      refreshTaskDetail,
      refreshBookmarksOnly,
      handleDeleteTask,
      handleCreateTaskBookmark,
      handleCreateEventBookmark,
      handleDeleteBookmark,
      handleTaskStatusChange,
      handleTaskTitleSubmit
    ]
  );

  return (
    <MonitorContext.Provider value={value}>
      {children}
    </MonitorContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMonitorStore(): MonitorContextValue {
  const ctx = useContext(MonitorContext);
  if (!ctx) {
    throw new Error("useMonitorStore must be used inside <MonitorProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isConnectorKeyValidForTimeline(
  key: string,
  events: readonly TimelineEvent[]
): boolean {
  const [sourceEventId, targetPart] = key.split("→");
  if (!sourceEventId || !targetPart) return false;
  const [targetEventId] = targetPart.split(":");
  if (!targetEventId) return false;
  return events.some((e) => e.id === sourceEventId) && events.some((e) => e.id === targetEventId);
}

// SearchResponse는 useSearch에서 사용되므로 여기서 re-export
export type { SearchResponse };
