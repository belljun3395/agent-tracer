import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMonitorStore } from "@monitor/web-store";
import { cn } from "../lib/ui/cn.js";
import { TaskList } from "./TaskList.js";
import { buildQuestionGroups, buildTodoGroups } from "@monitor/web-core";
import type { BookmarkRecord } from "@monitor/web-core";
interface SidebarContainerProps {
    readonly onSelectTask: (taskId: string | null) => void;
    readonly onClose: () => void;
    readonly initialView?: "tasks" | "saved";
    readonly isPinned?: boolean;
    readonly onTogglePin?: () => void;
}
export function SidebarContainer({ onSelectTask, onClose, initialView = "tasks", isPinned = false, onTogglePin }: SidebarContainerProps): React.JSX.Element {
    const { state, dispatch, refreshOverview, handleDeleteTask, handleCreateTaskBookmark, handleDeleteBookmark } = useMonitorStore();
    const { tasks, bookmarks, selectedTaskId, taskDetail, deletingTaskId, deleteErrorTaskId, taskDisplayTitleCache } = state;
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: KeyboardEvent): void => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);
    useEffect(() => {
        const handler = (e: MouseEvent): void => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const t = setTimeout(() => window.addEventListener("mousedown", handler), 100);
        return () => {
            clearTimeout(t);
            window.removeEventListener("mousedown", handler);
        };
    }, [onClose]);
    const selectedTaskBookmark = bookmarks.find((b) => b.taskId === (selectedTaskId ?? "") && !b.eventId) ?? null;
    const taskTimeline = taskDetail?.timeline ?? [];
    const questionCount = useMemo(() => buildQuestionGroups(taskTimeline).length, [taskTimeline]);
    const todoCount = useMemo(() => buildTodoGroups(taskTimeline).length, [taskTimeline]);
    const handleSelectBookmark = useCallback((bookmark: BookmarkRecord): void => {
        dispatch({ type: "SELECT_CONNECTOR", connectorKey: null });
        onSelectTask(bookmark.taskId);
        dispatch({ type: "SELECT_EVENT", eventId: bookmark.eventId ?? null });
        onClose();
    }, [dispatch, onSelectTask, onClose]);
    const handleDeleteBookmarkWithError = useCallback((bookmarkId: string): void => {
        void handleDeleteBookmark(bookmarkId).catch((err) => {
            dispatch({
                type: "SET_STATUS",
                status: "error",
                errorMessage: err instanceof Error ? err.message : "Failed to delete bookmark."
            });
        });
    }, [dispatch, handleDeleteBookmark]);
    const handleSaveTaskBookmark = useCallback((): void => {
        void handleCreateTaskBookmark().catch((err) => {
            dispatch({
                type: "SET_STATUS",
                status: "error",
                errorMessage: err instanceof Error ? err.message : "Failed to save task bookmark."
            });
        });
    }, [dispatch, handleCreateTaskBookmark]);
    const handleSelectTask = useCallback((id: string): void => {
        onSelectTask(id);
        if (!isPinned)
            onClose();
    }, [onSelectTask, onClose, isPinned]);
    return (<div ref={panelRef} className="flex h-full w-[280px] flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
      
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3">
        <span className="text-[0.72rem] font-semibold tracking-[0.02em] text-[var(--text-2)]">Agent Tracer</span>
        <div className="flex items-center gap-1">
          {onTogglePin && (<button aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"} className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]", isPinned
                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
                : "text-[var(--text-3)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]")} onClick={onTogglePin} title={isPinned ? "Unpin sidebar" : "Pin sidebar"} type="button">
              
              <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
                <path d="M12 2L8 8H4l2 6h3v8l3-3 3 3v-8h3l2-6h-4L12 2z"/>
              </svg>
            </button>)}
          {!isPinned && (<button aria-label="Close panel" className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={onClose} type="button">
              <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>)}
        </div>
      </div>

      <TaskList tasks={tasks} bookmarks={bookmarks} taskDisplayTitleCache={taskDisplayTitleCache} selectedTaskBookmarkId={selectedTaskBookmark?.id ?? null} selectedTaskId={selectedTaskId} taskDetail={taskDetail} selectedTaskQuestionCount={questionCount} selectedTaskTodoCount={todoCount} deletingTaskId={deletingTaskId} deleteErrorTaskId={deleteErrorTaskId} isCollapsed={false} hideHeader initialView={initialView} onToggleCollapse={onClose} onSelectTask={handleSelectTask} onSelectBookmark={handleSelectBookmark} onDeleteBookmark={handleDeleteBookmarkWithError} onSaveTaskBookmark={handleSaveTaskBookmark} onDeleteTask={(id) => void handleDeleteTask(id)} onRefresh={() => void refreshOverview()}/>
    </div>);
}
