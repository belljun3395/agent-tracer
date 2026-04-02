/**
 * 전역 모니터 상태 관리.
 * Zustand 스토어로 App 전역 상태를 집중 관리.
 * useReducer + Context 패턴에서 마이그레이션됨.
 */

import React from "react";
import { create } from "zustand";

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
// State type (preserved for API compatibility)
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
// Actions type (preserved for API compatibility — dispatch({ type: ... }))
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
// Internal helpers
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

/**
 * Merges a freshly-fetched TaskDetailResponse into the cached previous value.
 * Exported for unit testing.
 *
 * Rules:
 *  - If prev refers to a different task, return the new detail as-is.
 *  - If nothing changed (same task + unchanged timeline), return prev (referential
 *    stability so consumers don't re-render).
 *  - Otherwise, merge timeline events and preserve `runtimeSessionId`, preferring
 *    the freshest non-empty value from `detail` and falling back to `prev`.
 */
export function mergeTaskDetail(
  prev: TaskDetailResponse,
  detail: TaskDetailResponse
): TaskDetailResponse {
  if (prev.task.id !== detail.task.id) return detail;
  const sameTask = prev.task.updatedAt === detail.task.updatedAt;
  const mergedTimeline = mergeTimeline(prev.timeline, detail.timeline);
  const timelineUnchanged = mergedTimeline === prev.timeline;
  if (sameTask && timelineUnchanged) return prev;
  const resolvedRuntimeSessionId = detail.runtimeSessionId ?? prev.runtimeSessionId;
  return {
    task: sameTask ? prev.task : detail.task,
    timeline: mergedTimeline,
    ...(resolvedRuntimeSessionId !== undefined ? { runtimeSessionId: resolvedRuntimeSessionId } : {})
  };
}

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

function applyAction(state: MonitorState, action: MonitorAction): MonitorState {
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
// Zustand store shape
// ---------------------------------------------------------------------------

interface MonitorStoreSlice {
  // The nested `state` object, preserved for consumer API compatibility
  state: MonitorState;

  // dispatch-style action applicator (preserved for consumers using dispatch({ type: ... }))
  dispatch: (action: MonitorAction) => void;

  // Async action methods
  refreshOverview: () => Promise<void>;
  refreshTaskDetail: (taskId: string) => Promise<void>;
  refreshBookmarksOnly: () => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleCreateTaskBookmark: () => Promise<void>;
  handleCreateEventBookmark: (eventId: string, eventTitle: string) => Promise<void>;
  handleDeleteBookmark: (bookmarkId: string) => Promise<void>;
  handleTaskStatusChange: (status: MonitoringTask["status"]) => Promise<void>;
  handleTaskTitleSubmit: (
    event: React.SyntheticEvent<HTMLFormElement>,
    nextTitle: string
  ) => Promise<void>;
}

const INITIAL_STATE: MonitorState = {
  tasks: [],
  bookmarks: [],
  overview: null,
  selectedTaskId: null,
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

// ---------------------------------------------------------------------------
// Internal Zustand store (singleton)
// ---------------------------------------------------------------------------

const _monitorStore = create<MonitorStoreSlice>((set, get) => {
  // Helper: apply a MonitorAction to the nested state object
  function dispatch(action: MonitorAction): void {
    set((slice) => ({ state: applyAction(slice.state, action) }));
  }

  // Helper: read current nested state without subscribing
  function getState(): MonitorState {
    return get().state;
  }

  // ------------------------------------------------------------------
  // refreshOverview
  // ------------------------------------------------------------------
  async function refreshOverview(): Promise<void> {
    const currentStatus = getState().status;
    dispatch({
      type: "SET_STATUS",
      status: currentStatus === "ready" ? "ready" : "loading",
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
          const prev = getState().tasks;
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
  }

  // ------------------------------------------------------------------
  // refreshTaskDetail
  // ------------------------------------------------------------------
  async function refreshTaskDetail(taskId: string): Promise<void> {
    try {
      const detail = await fetchTaskDetail(taskId);
      dispatch({
        type: "SET_TASK_DETAIL",
        detail: (() => {
          const prev = getState().taskDetail;
          if (!prev) return detail;
          return mergeTaskDetail(prev, detail);
        })()
      });

      // connector key 유효성 검사
      const currentConnector = getState().selectedConnectorKey;
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
          const current = getState().selectedEventId;
          if (current && detail.timeline.some((e) => e.id === current)) return current;
          return detail.timeline[detail.timeline.length - 1]?.id ?? null;
        })()
      });
    } catch (err) {
      const status = err instanceof Error ? (err as Error & { readonly status?: number }).status : undefined;
      dispatch({
        type: "SET_STATUS",
        status: "error",
        errorMessage: status === 404
          ? "Task not found."
          : err instanceof Error
            ? err.message
            : "Failed to load task detail."
      });
    }
  }

  // ------------------------------------------------------------------
  // refreshBookmarksOnly
  // ------------------------------------------------------------------
  async function refreshBookmarksOnly(): Promise<void> {
    const response = await fetchBookmarks();
    dispatch({ type: "SET_BOOKMARKS", bookmarks: response.bookmarks });
  }

  // ------------------------------------------------------------------
  // handleDeleteTask
  // ------------------------------------------------------------------
  async function handleDeleteTask(taskId: string): Promise<void> {
    dispatch({ type: "SET_DELETING_TASK_ID", taskId });
    try {
      await deleteTask(taskId);
      if (getState().selectedTaskId === taskId) {
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
  }

  // ------------------------------------------------------------------
  // handleCreateTaskBookmark
  // ------------------------------------------------------------------
  async function handleCreateTaskBookmark(): Promise<void> {
    const { selectedTaskId, taskDetail, taskDisplayTitleCache } = getState();
    if (!selectedTaskId) return;
    const displayTitle = taskDetail?.task
      ? (taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title)
      : undefined;
    await createBookmark(displayTitle !== undefined
      ? { taskId: selectedTaskId, title: displayTitle }
      : { taskId: selectedTaskId });
    await refreshBookmarksOnly();
  }

  // ------------------------------------------------------------------
  // handleCreateEventBookmark
  // ------------------------------------------------------------------
  async function handleCreateEventBookmark(eventId: string, eventTitle: string): Promise<void> {
    const { selectedTaskId } = getState();
    if (!selectedTaskId) return;
    await createBookmark({ taskId: selectedTaskId, eventId, title: eventTitle });
    await refreshBookmarksOnly();
  }

  // ------------------------------------------------------------------
  // handleDeleteBookmark
  // ------------------------------------------------------------------
  async function handleDeleteBookmark(bookmarkId: string): Promise<void> {
    await deleteBookmark(bookmarkId);
    await refreshBookmarksOnly();
  }

  // ------------------------------------------------------------------
  // handleTaskStatusChange
  // ------------------------------------------------------------------
  async function handleTaskStatusChange(status: MonitoringTask["status"]): Promise<void> {
    const { taskDetail } = getState();
    if (!taskDetail?.task) return;
    dispatch({ type: "SET_UPDATING_TASK_STATUS", isUpdating: true });
    try {
      const updatedTask = await updateTaskStatus(taskDetail.task.id, status);
      dispatch({
        type: "SET_TASKS",
        tasks: getState().tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      });
      dispatch({
        type: "SET_TASK_DETAIL",
        detail:
          getState().taskDetail?.task.id === updatedTask.id
            ? { ...getState().taskDetail!, task: updatedTask }
            : getState().taskDetail
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
  }

  // ------------------------------------------------------------------
  // handleTaskTitleSubmit
  // ------------------------------------------------------------------
  async function handleTaskTitleSubmit(
    event: React.SyntheticEvent<HTMLFormElement>,
    nextTitle: string
  ): Promise<void> {
    event.preventDefault();
    const { taskDetail } = getState();
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
        tasks: getState().tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      });
      dispatch({
        type: "SET_TASK_DETAIL",
        detail:
          getState().taskDetail?.task.id === updatedTask.id
            ? { ...getState().taskDetail!, task: updatedTask }
            : getState().taskDetail
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
  }

  return {
    state: INITIAL_STATE,
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
  };
});

// ---------------------------------------------------------------------------
// MonitorProvider — initialises side-effects (clock, initial load, auto-select)
// that previously lived in the Provider component.
// Kept as a no-op wrapper so App.tsx doesn't need to change.
// ---------------------------------------------------------------------------

export function MonitorProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const storeRef = React.useRef(false);

  React.useEffect(() => {
    if (storeRef.current) return;
    storeRef.current = true;

    // Initial data load
    void _monitorStore.getState().refreshOverview();

    // Live clock: update nowMs every 10 seconds
    const clockTimer = setInterval(() => {
      _monitorStore.getState().dispatch({ type: "SET_NOW_MS", nowMs: Date.now() });
    }, 10_000);

    return () => {
      clearInterval(clockTimer);
    };
  }, []);

  // auto-select first task & load task detail when selectedTaskId changes
  const state = _monitorStore((s) => s.state);

  React.useEffect(() => {
    const { tasks, selectedTaskId, status } = state;
    if (tasks.length === 0) {
      if (status === "ready") {
        _monitorStore.getState().dispatch({ type: "SELECT_TASK", taskId: null });
        _monitorStore.getState().dispatch({ type: "SET_TASK_DETAIL", detail: null });
      }
      return;
    }
    if (!selectedTaskId) {
      _monitorStore.getState().dispatch({ type: "SELECT_TASK", taskId: tasks[0]?.id ?? null });
    }
  }, [state.status, state.tasks]);

  React.useEffect(() => {
    if (!state.selectedTaskId) return;
    void _monitorStore.getState().refreshTaskDetail(state.selectedTaskId);
  }, [state.selectedTaskId]);

  React.useEffect(() => {
    _monitorStore.getState().dispatch({ type: "RESET_TASK_FILTERS" });
  }, [state.selectedTaskId]);

  // taskDisplayTitleCache: update display title for selected task
  React.useEffect(() => {
    const { taskDetail } = state;
    if (!taskDetail?.task) return;
    const displayTitle = buildTaskDisplayTitle(taskDetail.task, taskDetail.timeline);
    if (!displayTitle) return;
    _monitorStore.getState().dispatch({
      type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
      taskId: taskDetail.task.id,
      title: displayTitle,
      updatedAt: taskDetail.task.updatedAt
    });
  }, [state.taskDetail]);

  // taskDisplayTitleCache: prune deleted tasks
  React.useEffect(() => {
    const validTaskIds = new Set(state.tasks.map((t) => t.id));
    _monitorStore.getState().dispatch({ type: "PRUNE_TASK_DISPLAY_TITLE_CACHE", validTaskIds });
  }, [state.tasks]);

  // Sync taskTitleDraft when editing mode is exited
  React.useEffect(() => {
    if (state.isEditingTaskTitle) return;
    const { taskDetail, taskDisplayTitleCache } = state;
    if (!taskDetail?.task) return;
    const displayTitle = taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title;
    _monitorStore.getState().dispatch({ type: "SET_TASK_TITLE_DRAFT", draft: displayTitle });
  }, [state.isEditingTaskTitle, state.taskDetail]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Public hook — preserves original API shape: { state, dispatch, refreshOverview, ... }
// ---------------------------------------------------------------------------

export function useMonitorStore(): MonitorStoreSlice {
  return _monitorStore();
}

// SearchResponse는 useSearch에서 사용되므로 여기서 re-export
export type { SearchResponse };
