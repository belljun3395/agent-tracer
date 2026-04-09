/**
 * 사이드바 플라이아웃 패널.
 * IconRail에서 Tasks/Saved 버튼 클릭 시 좌측에서 슬라이드되어 나오는 오버레이.
 * 리사이즈 핸들 없음 — 고정 너비(280px).
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useMonitorStore } from "../store/useMonitorStore.js";
import { TaskList } from "./TaskList.js";
import { buildQuestionGroups, buildTodoGroups } from "../lib/insights.js";
import type { BookmarkRecord } from "../types.js";

interface SidebarContainerProps {
  readonly onSelectTask: (taskId: string | null) => void;
  readonly onClose: () => void;
  readonly initialView?: "tasks" | "saved";
}

export function SidebarContainer({
  onSelectTask,
  onClose,
  initialView = "tasks"
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

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay so the click that opened the flyout doesn't immediately close it
    const t = setTimeout(() => window.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

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
      onClose();
    },
    [dispatch, onSelectTask, onClose]
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

  const handleSelectTask = useCallback(
    (id: string): void => {
      onSelectTask(id);
      onClose();
    },
    [onSelectTask, onClose]
  );

  return (
    <div
      ref={panelRef}
      className="flex h-full w-[280px] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] shadow-[4px_0_24px_rgba(0,0,0,0.12)]"
    >
      {/* Compact flyout header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-3">
        <span className="text-[0.78rem] font-semibold text-[var(--text-1)]">Agent Tracer</span>
        <button
          aria-label="Close panel"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

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
        isCollapsed={false}
        hideHeader
        initialView={initialView}
        onToggleCollapse={onClose}
        onSelectTask={handleSelectTask}
        onSelectBookmark={handleSelectBookmark}
        onDeleteBookmark={handleDeleteBookmarkWithError}
        onSaveTaskBookmark={handleSaveTaskBookmark}
        onDeleteTask={(id) => void handleDeleteTask(id)}
        onRefresh={() => void refreshOverview()}
      />
    </div>
  );
}
