/**
 * 사이드바 컨테이너.
 * 태스크 목록 + 사이드바 리사이즈 핸들러를 감싸는 focused 컴포넌트.
 */

import type React from "react";
import { useCallback, useMemo } from "react";

import { useMonitorStore } from "../store/useMonitorStore.js";
import { cn } from "../lib/ui/cn.js";
import { TaskList } from "./TaskList.js";
import { buildQuestionGroups, buildTodoGroups } from "../lib/insights.js";
import type { BookmarkRecord } from "../types.js";

interface SidebarContainerProps {
  readonly isCompactDashboard: boolean;
  readonly isStackedDashboard: boolean;
  readonly isSidebarCollapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly onSidebarResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  readonly onSelectTask: (taskId: string | null) => void;
}

export function SidebarContainer({
  isCompactDashboard,
  isStackedDashboard,
  isSidebarCollapsed,
  onToggleCollapse,
  onSidebarResizeStart,
  onSelectTask
}: SidebarContainerProps): React.JSX.Element {
  const {
    state,
    dispatch,
    refreshOverview,
    handleDeleteTask,
    handleCreateTaskBookmark,
    handleDeleteBookmark
  } = useMonitorStore();

  const {
    tasks,
    bookmarks,
    selectedTaskId,
    taskDetail,
    deletingTaskId,
    deleteErrorTaskId,
    taskDisplayTitleCache
  } = state;

  const selectedTaskBookmark = bookmarks.find(
    (b) => b.taskId === (selectedTaskId ?? "") && !b.eventId
  ) ?? null;

  const taskTimeline = taskDetail?.timeline ?? [];
  const questionCount = useMemo(() => buildQuestionGroups(taskTimeline).length, [taskTimeline]);
  const todoCount = useMemo(() => buildTodoGroups(taskTimeline).length, [taskTimeline]);

  const handleSelectBookmark = useCallback(
    (bookmark: BookmarkRecord): void => {
      dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
      onSelectTask(bookmark.taskId);
      dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId ?? null });
    },
    [dispatch, onSelectTask]
  );

  const handleDeleteBookmarkWithError = useCallback(
    (bookmarkId: string): void => {
      void handleDeleteBookmark(bookmarkId).catch((err) => {
        dispatch({
          type: "SET_STATUS",
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Failed to delete bookmark."
        });
      });
    },
    [dispatch, handleDeleteBookmark]
  );

  const handleSaveTaskBookmark = useCallback((): void => {
    void handleCreateTaskBookmark().catch((err) => {
      dispatch({
        type: "SET_STATUS",
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
      });
    });
  }, [dispatch, handleCreateTaskBookmark]);

  return (
    <div
      className={cn(
        "sidebar-slot relative flex min-h-0 min-w-0 flex-col overflow-hidden",
        isCompactDashboard && "min-h-[21rem]",
        isStackedDashboard && "order-2 overflow-visible"
      )}
    >
      <TaskList
        tasks={tasks}
        bookmarks={bookmarks}
        taskDisplayTitleCache={taskDisplayTitleCache}
        selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null}
        selectedTaskId={selectedTaskId}
        taskDetail={taskDetail}
        selectedTaskQuestionCount={questionCount}
        selectedTaskTodoCount={todoCount}
        deletingTaskId={deletingTaskId}
        deleteErrorTaskId={deleteErrorTaskId}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        onSelectTask={(id) => onSelectTask(id)}
        onSelectBookmark={handleSelectBookmark}
        onDeleteBookmark={handleDeleteBookmarkWithError}
        onSaveTaskBookmark={handleSaveTaskBookmark}
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
  );
}
