/**
 * 사이드바 태스크 목록.
 * 태스크 선택, 삭제 기능 포함.
 * 각 태스크의 상태, 제목, 경로, 마지막 업데이트 시간 표시.
 */

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type {
  BookmarkRecord,
  MonitoringTask,
  TaskDetailResponse
} from "../types.js";
import { formatRelativeTime } from "../lib/timeline.js";
import { buildTaskDisplayTitle } from "../lib/insights.js";
import { useDragScroll } from "../lib/useDragScroll.js";
import { cn } from "../lib/ui/cn.js";
import { Badge } from "./ui/Badge.js";
import { Button } from "./ui/Button.js";
import { PanelCard } from "./ui/PanelCard.js";

interface TaskDisplayTitleCacheEntry {
  readonly title: string;
  readonly updatedAt: string;
}

interface TaskListProps {
  readonly tasks: readonly MonitoringTask[];
  readonly bookmarks: readonly BookmarkRecord[];
  readonly taskDisplayTitleCache?: Readonly<Record<string, TaskDisplayTitleCacheEntry>>;
  readonly selectedTaskBookmarkId: string | null;
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedTaskQuestionCount?: number | undefined;
  readonly selectedTaskTodoCount?: number | undefined;
  readonly deletingTaskId: string | null;
  readonly deleteErrorTaskId: string | null;
  readonly isCollapsed?: boolean;
  readonly hideHeader?: boolean;
  readonly initialView?: "tasks" | "saved";
  readonly onToggleCollapse?: () => void;
  readonly onSelectTask: (taskId: string) => void;
  readonly onSelectBookmark: (bookmark: BookmarkRecord) => void;
  readonly onDeleteBookmark: (bookmarkId: string) => void;
  readonly onSaveTaskBookmark: () => void;
  readonly onDeleteTask: (taskId: string) => void;
  readonly onRefresh: () => void;
}

interface DisplayTaskRow {
  readonly task: MonitoringTask;
  readonly depth: 0 | 1;
}

interface BuildTaskListRowsOptions {
  readonly collapsedParentIds?: ReadonlySet<string>;
}

interface RuntimeFilterOption {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

type RailView = "tasks" | "saved";

const railSectionHeaderClass =
  "sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]";

const railRowBaseClass =
  "group relative shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-transparent px-2.5 py-2 transition-[background-color,border-color] duration-150 hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] cursor-pointer";

const railSelectedRowClass =
  "bg-[var(--surface-2)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--accent)] before:content-['']";

const railContentButtonClass =
  "flex min-w-0 flex-col items-start justify-start rounded-none border-0 bg-transparent p-0 text-left font-normal shadow-none outline-none transition-colors";

const ALL_RUNTIME_FILTER_KEY = "all";

/**
 * 사이드바 태스크 목록 컴포넌트.
 * 태스크 선택 및 개별 삭제를 지원.
 */
export function TaskList({
  tasks,
  bookmarks,
  taskDisplayTitleCache,
  selectedTaskBookmarkId,
  selectedTaskId,
  taskDetail,
  selectedTaskQuestionCount,
  selectedTaskTodoCount,
  deletingTaskId,
  deleteErrorTaskId,
  isCollapsed = false,
  hideHeader = false,
  initialView = "tasks",
  onToggleCollapse,
  onSelectTask,
  onSelectBookmark,
  onDeleteBookmark,
  onSaveTaskBookmark,
  onDeleteTask,
  onRefresh
}: TaskListProps): React.JSX.Element {
  const [runtimeFilter, setRuntimeFilter] = useState<string>(ALL_RUNTIME_FILTER_KEY);
  const [collapsedParentIds, setCollapsedParentIds] = useState<ReadonlySet<string>>(new Set());
  const [railView, setRailView] = useState<RailView>(initialView);

  // Sync tab when parent switches the panel (e.g. clicking Saved vs Tasks on the icon rail)
  useEffect(() => {
    setRailView(initialView);
  }, [initialView]);
  const tasksDragScroll = useDragScroll({ axis: "y" });
  const runtimeFilterOptions = useMemo(
    () => buildRuntimeFilterOptions(tasks),
    [tasks]
  );
  const filteredTasks = useMemo(
    () => filterTasksByRuntime(tasks, runtimeFilter),
    [tasks, runtimeFilter]
  );
  const childCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of filteredTasks) {
      if (!task.parentTaskId) continue;
      const count = counts.get(task.parentTaskId) ?? 0;
      counts.set(task.parentTaskId, count + 1);
    }
    return counts;
  }, [filteredTasks]);

  const displayRows = useMemo(
    () => buildTaskListRows(filteredTasks, { collapsedParentIds }),
    [filteredTasks, collapsedParentIds]
  );

  useEffect(() => {
    if (runtimeFilterOptions.some((option) => option.key === runtimeFilter)) return;
    setRuntimeFilter(ALL_RUNTIME_FILTER_KEY);
  }, [runtimeFilter, runtimeFilterOptions]);

  useEffect(() => {
    const validParentIds = new Set<string>(
      filteredTasks
        .filter((task) => (childCountByParentId.get(task.id) ?? 0) > 0)
        .map((task) => task.id)
    );

    setCollapsedParentIds((current) => {
      const next = new Set<string>();
      for (const parentId of current) {
        if (validParentIds.has(parentId)) {
          next.add(parentId);
        }
      }
      return next.size === current.size ? current : next;
    });
  }, [filteredTasks, childCountByParentId]);

  useEffect(() => {
    if (!selectedTaskId) return;

    const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId);
    const parentId = selectedTask?.parentTaskId;
    if (!parentId) return;

    setCollapsedParentIds((current) => {
      if (!current.has(parentId)) return current;
      const next = new Set(current);
      next.delete(parentId);
      return next;
    });
  }, [selectedTaskId, filteredTasks]);

  return (
    <PanelCard className={cn("relative flex-1", isCollapsed && "items-center")}>
      {!hideHeader && (
        <Button
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute right-2 top-2 h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[0.78rem] text-[var(--text-3)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface)] hover:text-[var(--text-2)]",
            isCollapsed && "static mx-auto mt-2"
          )}
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          variant="bare"
          size="icon"
        >
          <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="14">
            {isCollapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </Button>
      )}

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", isCollapsed && "hidden")}>
        {!hideHeader && (
          <div className="border-b border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] px-4 py-[15px] pr-11">
            <p className="m-0 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Monitor</p>
            <h1 className="mt-1 text-[1rem] font-semibold tracking-[-0.02em] text-[var(--text-1)]">AI CLI Timeline</h1>
            <p className="mt-1 text-[0.78rem] leading-5 text-[var(--text-2)]">Live task observability for parallel agent work.</p>
          </div>
        )}

        {/* Compact action toolbar */}
        <div className="flex items-center gap-0.5 border-b border-[var(--border)] px-1.5 py-1">
          <button
            className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[0.72rem] font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            onClick={onRefresh}
            title="Refresh snapshot"
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            <span>Refresh</span>
          </button>
          <div className="flex-1" />
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[0.72rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
              selectedTaskBookmarkId
                ? "cursor-pointer text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] hover:opacity-80"
                : selectedTaskId
                  ? "cursor-pointer text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
                  : "cursor-not-allowed text-[var(--text-3)] opacity-40"
            )}
            disabled={!selectedTaskId}
            onClick={selectedTaskBookmarkId ? () => onDeleteBookmark(selectedTaskBookmarkId) : onSaveTaskBookmark}
            title={selectedTaskBookmarkId ? "Click to remove bookmark" : "Save current task"}
            type="button"
          >
            <svg aria-hidden="true" fill={selectedTaskBookmarkId ? "currentColor" : "none"} height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="12">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>{selectedTaskBookmarkId ? "Saved" : "Save task"}</span>
          </button>
        </div>

        {/* Underline tab switcher */}
        <div className="flex border-b border-[var(--border)]">
          <button
            aria-pressed={railView === "tasks"}
            className={cn(
              "relative flex-1 py-2 text-[0.77rem] font-medium transition-colors focus-visible:outline-none cursor-pointer",
              railView === "tasks" ? "text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            )}
            onClick={() => setRailView("tasks")}
            type="button"
          >
            Tasks
            {railView === "tasks" && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
          <button
            aria-pressed={railView === "saved"}
            className={cn(
              "relative flex-1 py-2 text-[0.77rem] font-medium transition-colors focus-visible:outline-none cursor-pointer",
              railView === "saved" ? "text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            )}
            onClick={() => setRailView("saved")}
            type="button"
          >
            Saved
            {railView === "saved" && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        </div>

        {railView === "saved" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={railSectionHeaderClass}>
              <span>Saved</span>
            </div>

            {bookmarks.length === 0 ? (
              <div className="m-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)]/40 p-3">
                <p className="m-0 text-[0.84rem] text-[var(--text-2)]">No saved cards yet.</p>
                <p className="mt-1 m-0 text-[0.79rem] text-[var(--text-2)]">Save the current task or a selected event to come back to it quickly.</p>
              </div>
            ) : (
              <div className="flex max-h-[calc(100%-2.5rem)] flex-col gap-1 overflow-y-auto p-1.5">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className={cn(
                      railRowBaseClass,
                      bookmark.id === selectedTaskBookmarkId && railSelectedRowClass
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <button
                        className={cn(railContentButtonClass, "min-w-0 flex-1")}
                        onClick={() => onSelectBookmark(bookmark)}
                        title={bookmark.title}
                        type="button"
                      >
                        <div className="w-full truncate text-[0.89rem] font-semibold leading-5 text-[var(--text-1)]">
                          {bookmark.title}
                        </div>
                        <div className="mt-1 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.7rem] text-[var(--text-3)]">
                          <Badge className="uppercase tracking-[0.06em]" size="sm" tone="accent">
                            {bookmark.kind}
                          </Badge>
                          <span className="min-w-0 truncate font-mono text-[0.71rem]">
                            {bookmark.eventTitle ?? bookmark.taskTitle ?? bookmark.taskId}
                          </span>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0">{formatRelativeTime(bookmark.updatedAt)}</span>
                        </div>
                      </button>
                      <Button
                        className="h-6 w-6 shrink-0 self-start rounded-md p-1 text-[var(--text-3)] opacity-0 transition-opacity hover:bg-[var(--err-bg)] hover:text-[var(--err)] group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteBookmark(bookmark.id);
                        }}
                        size="icon"
                        title="Remove saved item"
                        variant="bare"
                      >
                        <img alt="Remove saved item" className="icon-adaptive h-3.5 w-3.5" src="/icons/trash.svg" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={railSectionHeaderClass}>
              <span>Tracked Tasks</span>
              {filteredTasks.length > 10 && (
                <span className="ml-auto text-[0.62rem] font-normal normal-case tracking-normal text-[var(--text-3)]">
                  Drag to browse
                </span>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="m-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)]/40 p-3">
                <p className="m-0 text-[0.84rem] text-[var(--text-2)]">No tasks yet.</p>
                <p className="mt-1 m-0 text-[0.79rem] text-[var(--text-2)]">
                  Send <code>monitor_task_start</code> through the MCP server or POST to{" "}
                  <code>/api/task-start</code>.
                </p>
              </div>
            ) : (
              <>
                {runtimeFilterOptions.length > 1 && (
                  <div className="border-b border-[var(--border)] px-2.5 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {runtimeFilterOptions.map((option) => {
                        const isActive = option.key === runtimeFilter;

                        return (
                          <button
                            key={option.key}
                            aria-pressed={isActive}
                            className={cn(
                              "inline-flex cursor-pointer items-center rounded-md px-2 py-0.5 text-[0.69rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                              isActive
                                ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                                : "text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text-2)]"
                            )}
                            onClick={() => setRuntimeFilter(option.key)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredTasks.length === 0 ? (
                  <div className="m-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)]/40 p-3">
                    <p className="m-0 text-[0.84rem] text-[var(--text-2)]">No tasks match this runtime.</p>
                    <button
                      className="mt-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[0.72rem] font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:bg-[var(--surface)]"
                      onClick={() => setRuntimeFilter(ALL_RUNTIME_FILTER_KEY)}
                      type="button"
                    >
                      Show all tasks
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex flex-1 flex-col gap-1 overflow-y-auto p-1.5"
                    style={{
                      cursor: tasksDragScroll.isDragging ? "grabbing" : "grab",
                      userSelect: tasksDragScroll.isDragging ? "none" : undefined
                    }}
                    {...tasksDragScroll.handlers}
                  >
                    {displayRows.map(({ task, depth }) => {
                      const taskDisplayTitle = resolveTaskListItemTitle(task, taskDisplayTitleCache?.[task.id]);
                      const childCount = childCountByParentId.get(task.id) ?? 0;
                      const hasChildren = childCount > 0;
                      const isCollapsedParent = collapsedParentIds.has(task.id);

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            railRowBaseClass,
                            depth > 0 &&
                              "ml-3.5 pl-3.5 before:absolute before:bottom-2.5 before:left-1 before:top-2.5 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--implementation-border)_66%,transparent)] before:content-['']",
                            task.id === selectedTaskId && railSelectedRowClass
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="pt-0.5">
                              {hasChildren ? (
                                <Button
                                  aria-label={isCollapsedParent ? "Expand child tasks" : "Collapse child tasks"}
                                  className="mt-0.5 h-4 w-4 shrink-0 justify-start rounded-none p-0 text-[0.8rem] text-[var(--text-3)] hover:text-[var(--accent)]"
                                  onClick={() => {
                                    setCollapsedParentIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(task.id)) {
                                        next.delete(task.id);
                                      } else {
                                        next.add(task.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  title={isCollapsedParent ? "Expand children" : "Collapse children"}
                                  variant="bare"
                                  size="icon"
                                >
                                  {isCollapsedParent ? "▸" : "▾"}
                                </Button>
                              ) : (
                                <span aria-hidden="true" className="mt-0.5 inline-block h-4 w-4 shrink-0" />
                              )}
                            </div>

                            <button
                              className={cn(railContentButtonClass, "min-w-0 flex-1")}
                              onClick={() => onSelectTask(task.id)}
                              title={taskDisplayTitle}
                              type="button"
                            >
                              <div className="w-full truncate text-[0.84rem] font-medium leading-5 text-[var(--text-1)]">
                                {taskDisplayTitle}
                              </div>

                              <div className="mt-1 flex w-full min-w-0 items-center gap-1.5 text-[0.7rem] text-[var(--text-3)]">
                                {/* Status dot */}
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    task.status === "running"
                                      ? "animate-pulse bg-[var(--ok)]"
                                      : task.status === "waiting"
                                        ? "bg-[var(--warn)]"
                                        : task.status === "completed"
                                          ? "bg-[var(--accent)]"
                                          : "bg-[var(--err)]"
                                  )}
                                />
                                <span className="shrink-0 capitalize">{task.status}</span>
                                <span className="text-[var(--text-3)]/40">·</span>
                                <span className="shrink-0">{formatRelativeTime(task.updatedAt)}</span>
                                {task.runtimeSource && (
                                  <Badge
                                    className={cn(runtimeBadgeClass(task.runtimeSource), "ml-auto")}
                                    size="xs"
                                    tone="neutral"
                                  >
                                    {runtimeTagLabel(task.runtimeSource)}
                                  </Badge>
                                )}
                                {task.taskKind === "background" && (
                                  <Badge className="border-[color-mix(in_srgb,#6366f1_30%,transparent)] bg-[color-mix(in_srgb,#6366f1_10%,transparent)] text-[#6366f1]" size="xs" tone="neutral">
                                    bg
                                  </Badge>
                                )}
                              </div>

                              {task.id === selectedTaskId && (
                                <div className="mt-1.5 flex w-full min-w-0 flex-col gap-1">
                                  {task.workspacePath && (
                                    <div className="w-full truncate font-mono text-[0.67rem] text-[var(--text-3)]/60">
                                      {task.workspacePath}
                                    </div>
                                  )}
                                  {task.id === taskDetail?.task.id && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedTaskQuestionCount !== undefined && selectedTaskQuestionCount > 0 && (
                                        <Badge className="border-[var(--user-border)] bg-[var(--user-bg)] text-[var(--user)]" size="xs" tone="neutral">
                                          {selectedTaskQuestionCount}Q
                                        </Badge>
                                      )}
                                      {selectedTaskTodoCount !== undefined && selectedTaskTodoCount > 0 && (
                                        <Badge className="border-[var(--planning-border)] bg-[var(--planning-bg)] text-[var(--planning)]" size="xs" tone="neutral">
                                          {selectedTaskTodoCount} todo{selectedTaskTodoCount === 1 ? "" : "s"}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>

                            <Button
                              className={cn(
                                "h-6 w-6 shrink-0 rounded-md p-1 opacity-0 transition-opacity hover:bg-[var(--err-bg)] hover:opacity-100 group-hover:opacity-35",
                                deleteErrorTaskId === task.id ? "text-[var(--err)] hover:text-[var(--err)]" : "text-[var(--text-3)]",
                                deletingTaskId === task.id && "opacity-30"
                              )}
                              disabled={deletingTaskId === task.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              size="icon"
                              title="Delete task"
                              variant="bare"
                            >
                              <img alt="Delete" className="icon-adaptive h-3.5 w-3.5" src="/icons/trash.svg" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

export function resolveTaskListItemTitle(
  task: MonitoringTask,
  cachedTitle?: TaskDisplayTitleCacheEntry | null
): string {
  if (cachedTitle && cachedTitle.updatedAt === task.updatedAt) {
    return cachedTitle.title;
  }

  return buildTaskDisplayTitle(task, []);
}

export function buildTaskListRows(
  tasks: readonly MonitoringTask[],
  options: BuildTaskListRowsOptions = {}
): readonly DisplayTaskRow[] {
  if (tasks.length === 0) return [];

  const { collapsedParentIds = new Set<string>() } = options;

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParentId = new Map<string, MonitoringTask[]>();
  const roots: MonitoringTask[] = [];

  for (const task of tasks) {
    const parentId = task.parentTaskId;
    if (!parentId || !taskById.has(parentId)) {
      roots.push(task);
      continue;
    }

    const children = childrenByParentId.get(parentId);
    if (children) {
      children.push(task);
      continue;
    }

    childrenByParentId.set(parentId, [task]);
  }

  const rows: DisplayTaskRow[] = [];
  const seen = new Set<string>();
  const compareByLatest = (a: MonitoringTask, b: MonitoringTask): number =>
    Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

  const sortedRoots = [...roots].sort(compareByLatest);

  for (const root of sortedRoots) {
    if (seen.has(root.id)) continue;

    seen.add(root.id);
    rows.push({ task: root, depth: 0 });

    if (!collapsedParentIds.has(root.id)) {
      const children = [...(childrenByParentId.get(root.id) ?? [])].sort(compareByLatest);
      for (const child of children) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        rows.push({ task: child, depth: 1 });
      }
    }
  }

  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    if (task.parentTaskId && collapsedParentIds.has(task.parentTaskId)) continue;
    seen.add(task.id);
    rows.push({ task, depth: task.parentTaskId && taskById.has(task.parentTaskId) ? 1 : 0 });
  }

  return rows;
}

function runtimeTagSlug(source: string): string {
  if (source === "claude-hook") return "claude";
  if (source === "codex-skill") return "codex";
  return "other";
}

function runtimeBadgeClass(source: string): string {
  const slug = runtimeTagSlug(source);

  return cn(
    "ml-0 text-[0.6rem] normal-case",
    slug === "claude" && "border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_12%,transparent)] text-[#d97706]",
    slug === "codex" && "border-[color-mix(in_srgb,#0f766e_30%,transparent)] bg-[color-mix(in_srgb,#0f766e_12%,transparent)] text-[#0f766e]",
    slug === "other" && "border-[var(--border-1)] bg-[var(--bg-2)] text-[var(--text-2)]"
  );
}

export function runtimeTagLabel(source: string): string {
  if (source === "claude-hook") return "Claude Code";
  if (source === "claude-bridge") return "Claude Bridge";
  if (source === "codex-skill") return "Codex";
  return source;
}

export function runtimeObservabilityLabel(source?: string): string | null {
  if (!source) return null;
  if (source === "claude-bridge") return "Bridge observability";
  if (source === "codex-skill") return "Cooperative logging";
  return null;
}

export function runtimeFilterKey(source?: string): string {
  if (!source) return "unknown";
  const slug = runtimeTagSlug(source);
  return slug === "other" ? `source:${source}` : slug;
}

export function runtimeFilterLabel(key: string): string {
  if (key === ALL_RUNTIME_FILTER_KEY) return "All";
  if (key === "claude") return "Claude";
  if (key === "codex") return "Codex";
  if (key === "unknown") return "Unknown";
  return key.startsWith("source:") ? runtimeTagLabel(key.slice("source:".length)) : key;
}

export function filterTasksByRuntime(tasks: readonly MonitoringTask[], filterKey: string): readonly MonitoringTask[] {
  if (filterKey === ALL_RUNTIME_FILTER_KEY) return tasks;
  return tasks.filter((task) => runtimeFilterKey(task.runtimeSource) === filterKey);
}

export function buildRuntimeFilterOptions(tasks: readonly MonitoringTask[]): readonly RuntimeFilterOption[] {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const key = runtimeFilterKey(task.runtimeSource);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const customKeys = [...counts.keys()]
    .filter((key) => !["claude", "codex", "unknown"].includes(key))
    .sort((a, b) => runtimeFilterLabel(a).localeCompare(runtimeFilterLabel(b)));

  const orderedKeys = [
    "claude",
    "codex",
    ...customKeys,
    "unknown"
  ].filter((key) => counts.has(key));

  return [
    {
      key: ALL_RUNTIME_FILTER_KEY,
      label: runtimeFilterLabel(ALL_RUNTIME_FILTER_KEY),
      count: tasks.length
    },
    ...orderedKeys.map((key) => ({
      key,
      label: runtimeFilterLabel(key),
      count: counts.get(key) ?? 0
    }))
  ];
}
