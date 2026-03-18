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
  onToggleCollapse,
  onSelectTask,
  onSelectBookmark,
  onDeleteBookmark,
  onSaveTaskBookmark,
  onDeleteTask,
  onRefresh
}: TaskListProps): React.JSX.Element {
  const [collapsedParentIds, setCollapsedParentIds] = useState<ReadonlySet<string>>(new Set());
  const tasksDragScroll = useDragScroll({ axis: "y" });
  const taskTitleById = new Map(
    tasks.map((task) => [task.id, resolveTaskListItemTitle(task, taskDisplayTitleCache?.[task.id])])
  );
  const childCountByParentId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.parentTaskId) continue;
      const count = counts.get(task.parentTaskId) ?? 0;
      counts.set(task.parentTaskId, count + 1);
    }
    return counts;
  }, [tasks]);

  const displayRows = useMemo(
    () => buildTaskListRows(tasks, { collapsedParentIds }),
    [tasks, collapsedParentIds]
  );

  useEffect(() => {
    const validParentIds = new Set(
      tasks
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
  }, [tasks, childCountByParentId]);

  useEffect(() => {
    if (!selectedTaskId) return;

    const selectedTask = tasks.find((task) => task.id === selectedTaskId);
    const parentId = selectedTask?.parentTaskId;
    if (!parentId) return;

    setCollapsedParentIds((current) => {
      if (!current.has(parentId)) return current;
      const next = new Set(current);
      next.delete(parentId);
      return next;
    });
  }, [selectedTaskId, tasks]);

  return (
    <PanelCard className={cn("relative flex-1", isCollapsed && "items-center")}>
      <Button
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute right-2 top-2 h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[0.78rem] text-[var(--text-2)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]",
          isCollapsed && "static mx-auto mt-2"
        )}
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        variant="bare"
        size="icon"
      >
        {isCollapsed ? "›" : "‹"}
      </Button>

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", isCollapsed && "hidden")}>
        <div className="border-b border-[var(--border)] px-4 py-4 pr-11">
          <p className="m-0 text-[0.67rem] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Monitor</p>
          <h1 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--text-1)]">AI CLI Timeline</h1>
          <p className="mt-1 text-[0.79rem] text-[var(--text-2)]">Live task observability for parallel agent work.</p>
        </div>

        <Button
          className="mx-3 mt-2 w-[calc(100%-1.5rem)] justify-start gap-1.5 px-3 py-2 text-[0.82rem] font-medium"
          onClick={onRefresh}
          size="sm"
          variant="ghost"
        >
          <img alt="" className="h-3.5 w-3.5 opacity-60" src="/icons/refresh.svg" />
          Refresh Snapshot
        </Button>

        <Button
          className="mx-3 mt-2 w-[calc(100%-1.5rem)] justify-start gap-1.5 px-3 py-2 text-[0.82rem] font-medium"
          disabled={!selectedTaskId || selectedTaskBookmarkId !== null}
          onClick={onSaveTaskBookmark}
          size="sm"
          variant="ghost"
        >
          <img alt="" className="h-3.5 w-3.5 opacity-60" src="/icons/layers.svg" />
          {selectedTaskBookmarkId ? "Saved Current Task" : "Save Current Task"}
        </Button>

        <div className="flex max-h-[240px] flex-none flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-[14px] py-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">
            <span>Saved</span>
            <Badge className="normal-case tracking-normal" size="xs" tone="neutral">
              {bookmarks.length}
            </Badge>
          </div>

          {bookmarks.length === 0 ? (
            <div className="m-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)]/40 p-3">
              <p className="m-0 text-[0.84rem] text-[var(--text-2)]">No saved cards yet.</p>
              <p className="mt-1 m-0 text-[0.79rem] text-[var(--text-2)]">Save the current task or a selected event to come back to it quickly.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-1.5">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className={cn(
                    "group relative flex items-start gap-2 rounded-[7px] border border-transparent px-2.5 py-2 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
                    bookmark.id === selectedTaskBookmarkId && "border-[var(--exploration-border)] bg-[var(--exploration-bg)]"
                  )}
                >
                  <Button
                    className="h-auto min-h-0 justify-start flex w-full min-w-0 flex-1 flex-col items-start rounded-none p-0 text-left font-normal shadow-none hover:bg-transparent"
                    onClick={() => onSelectBookmark(bookmark)}
                    variant="bare"
                  >
                    <div className="flex w-full items-center gap-1.5">
                      <Badge className="uppercase tracking-[0.06em]" size="sm" tone="accent">
                        {bookmark.kind}
                      </Badge>
                      <span className="ml-auto shrink-0 text-[0.7rem] text-[var(--text-3)]">{formatRelativeTime(bookmark.updatedAt)}</span>
                    </div>
                    <div className="mt-1 w-full truncate text-[0.84rem] font-semibold text-[var(--text-1)]">{bookmark.title}</div>
                    <div className="mt-0.5 w-full truncate font-mono text-[0.71rem] text-[var(--text-3)]">
                      {bookmark.eventTitle ?? bookmark.taskTitle ?? bookmark.taskId}
                    </div>
                  </Button>
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
                    <img alt="Remove saved item" className="h-3.5 w-3.5" src="/icons/trash.svg" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-[14px] py-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">
            <span>Tracked Tasks</span>
            <Badge className="normal-case tracking-normal" size="xs" tone="neutral">
              {tasks.length}
            </Badge>
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
                      "group relative flex items-start gap-2 rounded-[7px] border border-transparent px-2.5 py-2 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]",
                      depth > 0 && "ml-3.5 pl-3.5 before:absolute before:bottom-2.5 before:left-1 before:top-2.5 before:w-0.5 before:rounded-full before:bg-[color-mix(in_srgb,var(--implementation-border)_66%,transparent)]",
                      task.id === selectedTaskId && "border-[var(--exploration-border)] bg-[var(--exploration-bg)]"
                    )}
                  >
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

                    <Button
                      className="h-auto min-h-0 justify-start flex w-full min-w-0 flex-1 flex-col items-start rounded-none p-0 text-left font-normal shadow-none hover:bg-transparent"
                      onClick={() => onSelectTask(task.id)}
                      variant="bare"
                    >
                      <div className="flex w-full items-center gap-1.5">
                        <Badge
                          className="uppercase tracking-[0.06em]"
                          size="sm"
                          tone={task.status === "running" ? "success" : task.status === "completed" ? "accent" : "danger"}
                        >
                          {task.status}
                        </Badge>
                        <span className="ml-auto shrink-0 text-[0.7rem] text-[var(--text-3)]">{formatRelativeTime(task.updatedAt)}</span>
                      </div>

                      <div className="mt-1.5 w-full truncate text-[0.84rem] font-semibold text-[var(--text-1)]">
                        {taskDisplayTitle}
                      </div>

                      <div className="mt-1.5 flex w-full flex-wrap items-center gap-1.5">
                        {task.taskKind === "background" ? (
                          <Badge className="ml-0 border-[color-mix(in_srgb,#6366f1_30%,transparent)] bg-[color-mix(in_srgb,#6366f1_12%,transparent)] text-[#6366f1]" size="xs" tone="neutral">
                            background
                          </Badge>
                        ) : (
                          <Badge className="ml-0" size="xs" tone="neutral">
                            primary
                          </Badge>
                        )}
                        {task.runtimeSource && (
                          <Badge
                            className={runtimeBadgeClass(task.runtimeSource)}
                            size="xs"
                            tone="neutral"
                          >
                            {runtimeTagLabel(task.runtimeSource)}
                          </Badge>
                        )}
                        {(task.taskKind ?? "primary") === "primary" && childCount > 0 && (
                          <Badge className="border-[var(--planning-border)] bg-[var(--planning-bg)] text-[var(--planning)]" size="xs" tone="neutral">
                            {childCount} child{childCount === 1 ? "" : "ren"}
                          </Badge>
                        )}
                      </div>

                      {task.parentTaskId && (
                        <div className="mt-1 w-full truncate text-[0.71rem] text-[var(--text-3)]">
                          Parent: {taskTitleById.get(task.parentTaskId) ?? task.parentTaskId.slice(0, 8)}
                        </div>
                      )}

                      <div className="mt-1 w-full truncate font-mono text-[0.71rem] text-[var(--text-3)]">
                        {task.workspacePath ?? "—"}
                      </div>

                      {task.id === selectedTaskId && task.id === taskDetail?.task.id && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                    </Button>

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
                      <img alt="Delete" className="h-3.5 w-3.5" src="/icons/trash.svg" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
  if (source === "opencode-plugin") return "opencode";
  return "other";
}

function runtimeBadgeClass(source: string): string {
  const slug = runtimeTagSlug(source);

  return cn(
    "ml-0 text-[0.6rem] normal-case",
    slug === "claude" && "border-[color-mix(in_srgb,#d97706_30%,transparent)] bg-[color-mix(in_srgb,#d97706_12%,transparent)] text-[#d97706]",
    slug === "opencode" && "border-[color-mix(in_srgb,#818cf8_30%,transparent)] bg-[color-mix(in_srgb,#6366f1_12%,transparent)] text-[#818cf8]",
    slug === "other" && "border-[var(--border-1)] bg-[var(--bg-2)] text-[var(--text-2)]"
  );
}

function runtimeTagLabel(source: string): string {
  if (source === "claude-hook") return "Claude Code";
  if (source === "opencode-plugin") return "OpenCode";
  return source;
}
