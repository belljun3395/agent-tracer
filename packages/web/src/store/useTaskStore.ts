/**
 * Task slice — Zustand 5 store.
 *
 * Owns: tasks list, bookmarks, overview, selected task, task detail,
 * load status, delete state, clock, title-editing state, and the
 * taskDisplayTitleCache.
 *
 * Previously part of the monolithic useMonitorStore; extracted for
 * focused responsibility. Consumers should import from useMonitorStore
 * (backward-compat shim) rather than this module directly.
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
import type {
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  TaskDetailResponse,
  TimelineEvent
} from "../types.js";

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
 * Re-exported from useMonitorStore for consumers and unit tests.
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

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface TaskState {
  readonly tasks: readonly MonitoringTask[];
  readonly bookmarks: readonly BookmarkRecord[];
  readonly overview: OverviewResponse | null;
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
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
// Internal action type
// ---------------------------------------------------------------------------

export type TaskAction =
  | { type: "SET_OVERVIEW"; overview: OverviewResponse }
  | { type: "SET_TASKS"; tasks: readonly MonitoringTask[] }
  | { type: "SET_BOOKMARKS"; bookmarks: readonly BookmarkRecord[] }
  | { type: "SELECT_TASK"; taskId: string | null }
  | { type: "SET_TASK_DETAIL"; detail: TaskDetailResponse | null }
  | { type: "SET_STATUS"; status: TaskState["status"]; errorMessage?: string | null }
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
// Slice interface
// ---------------------------------------------------------------------------

export interface TaskStoreSlice {
  taskState: TaskState;
  dispatchTaskAction: (action: TaskAction) => void;

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

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function applyTaskAction(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case "SET_OVERVIEW":
      return { ...state, overview: action.overview };
    case "SET_TASKS":
      return { ...state, tasks: action.tasks };
    case "SET_BOOKMARKS":
      return { ...state, bookmarks: action.bookmarks };
    case "SELECT_TASK":
      return { ...state, selectedTaskId: action.taskId };
    case "SET_TASK_DETAIL":
      return { ...state, taskDetail: action.detail };
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
        isEditingTaskTitle: false,
        taskTitleError: null,
        isSavingTaskTitle: false
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_TASK_STATE: TaskState = {
  tasks: [],
  bookmarks: [],
  overview: null,
  selectedTaskId: null,
  taskDetail: null,
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
// Zustand store (singleton)
// ---------------------------------------------------------------------------

export const _taskStore = create<TaskStoreSlice>((set, get) => {
  function dispatch(action: TaskAction): void {
    set((slice) => ({ taskState: applyTaskAction(slice.taskState, action) }));
  }

  function getTaskState(): TaskState {
    return get().taskState;
  }

  // ------------------------------------------------------------------
  // refreshOverview
  // ------------------------------------------------------------------
  async function refreshOverview(): Promise<void> {
    const currentStatus = getTaskState().status;
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
          const prev = getTaskState().tasks;
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
          const prev = getTaskState().taskDetail;
          if (!prev) return detail;
          return mergeTaskDetail(prev, detail);
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
      if (getTaskState().selectedTaskId === taskId) {
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
    const { selectedTaskId, taskDetail, taskDisplayTitleCache } = getTaskState();
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
    const { selectedTaskId } = getTaskState();
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
    const { taskDetail } = getTaskState();
    if (!taskDetail?.task) return;
    dispatch({ type: "SET_UPDATING_TASK_STATUS", isUpdating: true });
    try {
      const updatedTask = await updateTaskStatus(taskDetail.task.id, status);
      dispatch({
        type: "SET_TASKS",
        tasks: getTaskState().tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      });
      dispatch({
        type: "SET_TASK_DETAIL",
        detail:
          getTaskState().taskDetail?.task.id === updatedTask.id
            ? { ...getTaskState().taskDetail!, task: updatedTask }
            : getTaskState().taskDetail
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
    const { taskDetail } = getTaskState();
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
        tasks: getTaskState().tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      });
      dispatch({
        type: "SET_TASK_DETAIL",
        detail:
          getTaskState().taskDetail?.task.id === updatedTask.id
            ? { ...getTaskState().taskDetail!, task: updatedTask }
            : getTaskState().taskDetail
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
    taskState: INITIAL_TASK_STATE,
    dispatchTaskAction: dispatch,
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

/**
 * Public hook for the task slice.
 * Most consumers should use useMonitorStore() from useMonitorStore.tsx instead.
 */
export function useTaskStore(): TaskStoreSlice {
  return _taskStore();
}
