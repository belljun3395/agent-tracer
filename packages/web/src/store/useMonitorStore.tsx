/**
 * 전역 모니터 상태 관리 — 슬라이스 합성 레이어.
 *
 * useTaskStore, useEventStore, useWebSocketStore 세 개의 focused 슬라이스로
 * 상태가 분리되었습니다. 이 파일은 기존 소비자 코드의 import 경로를 변경하지
 * 않아도 되도록 하위 호환 shim 역할을 합니다.
 *
 * Slice 분리 이후 아키텍처:
 *   useTaskStore      — tasks, bookmarks, overview, selectedTaskId, taskDetail,
 *                       status, editing state, display-title cache
 *   useEventStore     — selectedEventId, selectedConnectorKey, selectedRuleId,
 *                       selectedTag, showRuleGapsOnly
 *   useWebSocketStore — isConnected
 */

import React from "react";

import { _taskStore, mergeTaskDetail } from "./useTaskStore.js";
import { _eventStore } from "./useEventStore.js";
import { _wsStore } from "./useWebSocketStore.js";
import type { TaskStoreSlice } from "./useTaskStore.js";
import type { EventStoreSlice } from "./useEventStore.js";
import type { WebSocketStoreSlice } from "./useWebSocketStore.js";
import { buildTaskDisplayTitle } from "../lib/insights.js";
import type {
  BookmarkRecord,
  MonitoringTask,
  OverviewResponse,
  SearchResponse,
  TaskDetailResponse
} from "../types.js";

// Re-export mergeTaskDetail so existing unit tests importing from this module
// continue to work without changes.
export { mergeTaskDetail };

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
// Dispatch router — fans out to the appropriate slice
// ---------------------------------------------------------------------------

function dispatchToSlices(action: MonitorAction): void {
  switch (action.type) {
    // ---- event slice ----
    case "SELECT_EVENT":
      _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: action.eventId });
      return;
    case "SELECT_CONNECTOR":
      _eventStore.getState().dispatchEventAction({ type: "SELECT_CONNECTOR", connectorKey: action.connectorKey });
      return;
    case "SELECT_RULE":
      _eventStore.getState().dispatchEventAction({ type: "SELECT_RULE", ruleId: action.ruleId });
      return;
    case "SELECT_TAG":
      _eventStore.getState().dispatchEventAction({ type: "SELECT_TAG", tag: action.tag });
      return;
    case "SET_SHOW_RULE_GAPS_ONLY":
      _eventStore.getState().dispatchEventAction({ type: "SET_SHOW_RULE_GAPS_ONLY", show: action.show });
      return;

    // ---- ws slice ----
    case "SET_CONNECTED":
      _wsStore.getState().setConnected(action.isConnected);
      return;

    // ---- task slice ----
    case "SET_OVERVIEW":
      _taskStore.getState().dispatchTaskAction({ type: "SET_OVERVIEW", overview: action.overview });
      return;
    case "SET_TASKS":
      _taskStore.getState().dispatchTaskAction({ type: "SET_TASKS", tasks: action.tasks });
      return;
    case "SET_BOOKMARKS":
      _taskStore.getState().dispatchTaskAction({ type: "SET_BOOKMARKS", bookmarks: action.bookmarks });
      return;
    case "SELECT_TASK":
      _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: action.taskId });
      return;
    case "SET_TASK_DETAIL":
      _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_DETAIL", detail: action.detail });
      return;
    case "SET_STATUS":
      _taskStore.getState().dispatchTaskAction({ type: "SET_STATUS", status: action.status, errorMessage: action.errorMessage });
      return;
    case "SET_DELETING_TASK_ID":
      _taskStore.getState().dispatchTaskAction({ type: "SET_DELETING_TASK_ID", taskId: action.taskId });
      return;
    case "SET_DELETE_ERROR_TASK_ID":
      _taskStore.getState().dispatchTaskAction({ type: "SET_DELETE_ERROR_TASK_ID", taskId: action.taskId });
      return;
    case "SET_NOW_MS":
      _taskStore.getState().dispatchTaskAction({ type: "SET_NOW_MS", nowMs: action.nowMs });
      return;
    case "SET_EDITING_TASK_TITLE":
      _taskStore.getState().dispatchTaskAction({ type: "SET_EDITING_TASK_TITLE", isEditing: action.isEditing });
      return;
    case "SET_TASK_TITLE_DRAFT":
      _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_TITLE_DRAFT", draft: action.draft });
      return;
    case "SET_TASK_TITLE_ERROR":
      _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_TITLE_ERROR", error: action.error });
      return;
    case "SET_SAVING_TASK_TITLE":
      _taskStore.getState().dispatchTaskAction({ type: "SET_SAVING_TASK_TITLE", isSaving: action.isSaving });
      return;
    case "SET_UPDATING_TASK_STATUS":
      _taskStore.getState().dispatchTaskAction({ type: "SET_UPDATING_TASK_STATUS", isUpdating: action.isUpdating });
      return;
    case "PATCH_TASK_DISPLAY_TITLE_CACHE":
      _taskStore.getState().dispatchTaskAction({
        type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
        taskId: action.taskId,
        title: action.title,
        updatedAt: action.updatedAt
      });
      return;
    case "PRUNE_TASK_DISPLAY_TITLE_CACHE":
      _taskStore.getState().dispatchTaskAction({
        type: "PRUNE_TASK_DISPLAY_TITLE_CACHE",
        validTaskIds: action.validTaskIds
      });
      return;
    case "RESET_TASK_FILTERS":
      _taskStore.getState().dispatchTaskAction({ type: "RESET_TASK_FILTERS" });
      _eventStore.getState().dispatchEventAction({ type: "RESET_EVENT_FILTERS" });
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Composed MonitorStoreSlice — the public surface
// ---------------------------------------------------------------------------

export interface MonitorStoreSlice {
  state: MonitorState;
  dispatch: (action: MonitorAction) => void;

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
// Build composed MonitorState from slices (pure function, no hooks)
// ---------------------------------------------------------------------------

function buildComposedState(
  taskSlice: TaskStoreSlice,
  eventSlice: EventStoreSlice,
  wsSlice: WebSocketStoreSlice
): MonitorState {
  const ts = taskSlice.taskState;
  const es = eventSlice.eventState;
  const ws = wsSlice.wsState;
  return {
    tasks: ts.tasks,
    bookmarks: ts.bookmarks,
    overview: ts.overview,
    selectedTaskId: ts.selectedTaskId,
    taskDetail: ts.taskDetail,
    status: ts.status,
    errorMessage: ts.errorMessage,
    deletingTaskId: ts.deletingTaskId,
    deleteErrorTaskId: ts.deleteErrorTaskId,
    nowMs: ts.nowMs,
    isEditingTaskTitle: ts.isEditingTaskTitle,
    taskTitleDraft: ts.taskTitleDraft,
    taskTitleError: ts.taskTitleError,
    isSavingTaskTitle: ts.isSavingTaskTitle,
    isUpdatingTaskStatus: ts.isUpdatingTaskStatus,
    taskDisplayTitleCache: ts.taskDisplayTitleCache,
    selectedEventId: es.selectedEventId,
    selectedConnectorKey: es.selectedConnectorKey,
    selectedRuleId: es.selectedRuleId,
    selectedTag: es.selectedTag,
    showRuleGapsOnly: es.showRuleGapsOnly,
    isConnected: ws.isConnected
  };
}

// ---------------------------------------------------------------------------
// Public hook — preserves original API shape: { state, dispatch, refreshOverview, ... }
// ---------------------------------------------------------------------------

export function useMonitorStore(): MonitorStoreSlice {
  const taskSlice = _taskStore();
  const eventSlice = _eventStore();
  const wsSlice = _wsStore();

  const state = buildComposedState(taskSlice, eventSlice, wsSlice);

  return {
    state,
    dispatch: dispatchToSlices,
    refreshOverview: taskSlice.refreshOverview,
    refreshTaskDetail: taskSlice.refreshTaskDetail,
    refreshBookmarksOnly: taskSlice.refreshBookmarksOnly,
    handleDeleteTask: taskSlice.handleDeleteTask,
    handleCreateTaskBookmark: taskSlice.handleCreateTaskBookmark,
    handleCreateEventBookmark: taskSlice.handleCreateEventBookmark,
    handleDeleteBookmark: taskSlice.handleDeleteBookmark,
    handleTaskStatusChange: taskSlice.handleTaskStatusChange,
    handleTaskTitleSubmit: taskSlice.handleTaskTitleSubmit
  };
}

// ---------------------------------------------------------------------------
// MonitorProvider — initialises side-effects (clock, initial load, auto-select)
// Kept as a wrapper so App.tsx doesn't need to change.
// ---------------------------------------------------------------------------

export function MonitorProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const storeRef = React.useRef(false);

  React.useEffect(() => {
    if (storeRef.current) return;
    storeRef.current = true;

    // Initial data load
    void _taskStore.getState().refreshOverview();

    // Live clock: update nowMs every 10 seconds
    const clockTimer = setInterval(() => {
      _taskStore.getState().dispatchTaskAction({ type: "SET_NOW_MS", nowMs: Date.now() });
    }, 10_000);

    return () => {
      clearInterval(clockTimer);
    };
  }, []);

  // Subscribe to task state for side-effect reactions
  const taskState = _taskStore((s) => s.taskState);

  // Auto-select first task when tasks load
  React.useEffect(() => {
    const { tasks, selectedTaskId, status } = taskState;
    if (tasks.length === 0) {
      if (status === "ready") {
        _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: null });
        _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_DETAIL", detail: null });
      }
      return;
    }
    if (!selectedTaskId) {
      _taskStore.getState().dispatchTaskAction({ type: "SELECT_TASK", taskId: tasks[0]?.id ?? null });
    }
  }, [taskState.status, taskState.tasks]);

  // Load task detail when selected task changes, then validate event/connector
  React.useEffect(() => {
    if (!taskState.selectedTaskId) return;
    void _taskStore.getState().refreshTaskDetail(taskState.selectedTaskId).then(() => {
      const detail = _taskStore.getState().taskState.taskDetail;
      if (!detail) return;

      // Validate connector key against new timeline
      const connectorKey = _eventStore.getState().eventState.selectedConnectorKey;
      if (connectorKey) {
        const [sourceId, targetPart] = connectorKey.split("→");
        if (sourceId && targetPart) {
          const [targetId] = targetPart.split(":");
          const valid = targetId
            && detail.timeline.some((e) => e.id === sourceId)
            && detail.timeline.some((e) => e.id === targetId);
          if (!valid) {
            _eventStore.getState().dispatchEventAction({ type: "SELECT_CONNECTOR", connectorKey: null });
          }
        }
      }

      // Validate/restore selected event
      const current = _eventStore.getState().eventState.selectedEventId;
      const next = (current && detail.timeline.some((e) => e.id === current))
        ? current
        : (detail.timeline[detail.timeline.length - 1]?.id ?? null);
      if (next !== current) {
        _eventStore.getState().dispatchEventAction({ type: "SELECT_EVENT", eventId: next });
      }
    });
  }, [taskState.selectedTaskId]);

  // Reset event filters on task change
  React.useEffect(() => {
    _taskStore.getState().dispatchTaskAction({ type: "RESET_TASK_FILTERS" });
    _eventStore.getState().dispatchEventAction({ type: "RESET_EVENT_FILTERS" });
  }, [taskState.selectedTaskId]);

  // Update taskDisplayTitleCache for selected task
  React.useEffect(() => {
    const { taskDetail } = taskState;
    if (!taskDetail?.task) return;
    const displayTitle = buildTaskDisplayTitle(taskDetail.task, taskDetail.timeline);
    if (!displayTitle) return;
    _taskStore.getState().dispatchTaskAction({
      type: "PATCH_TASK_DISPLAY_TITLE_CACHE",
      taskId: taskDetail.task.id,
      title: displayTitle,
      updatedAt: taskDetail.task.updatedAt
    });
  }, [taskState.taskDetail]);

  // Prune deleted tasks from taskDisplayTitleCache
  React.useEffect(() => {
    const validTaskIds = new Set(taskState.tasks.map((t) => t.id));
    _taskStore.getState().dispatchTaskAction({ type: "PRUNE_TASK_DISPLAY_TITLE_CACHE", validTaskIds });
  }, [taskState.tasks]);

  // Sync taskTitleDraft when editing mode exits
  React.useEffect(() => {
    if (taskState.isEditingTaskTitle) return;
    const { taskDetail, taskDisplayTitleCache } = taskState;
    if (!taskDetail?.task) return;
    const displayTitle = taskDisplayTitleCache[taskDetail.task.id]?.title ?? taskDetail.task.title;
    _taskStore.getState().dispatchTaskAction({ type: "SET_TASK_TITLE_DRAFT", draft: displayTitle });
  }, [taskState.isEditingTaskTitle, taskState.taskDetail]);

  return <>{children}</>;
}

// SearchResponse는 useSearch에서 사용되므로 여기서 re-export
export type { SearchResponse };
