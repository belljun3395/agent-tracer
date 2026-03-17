/**
 * 사이드바 태스크 목록.
 * 태스크 선택, 삭제 기능 포함.
 * 각 태스크의 상태, 제목, 경로, 마지막 업데이트 시간 표시.
 */

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { MonitoringTask, TaskDetailResponse } from "../types.js";
import { formatRelativeTime } from "../lib/timeline.js";
import { buildTaskDisplayTitle } from "../lib/insights.js";

interface TaskListProps {
  readonly tasks: readonly MonitoringTask[];
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedTaskDisplayTitle?: string | null;
  readonly taskTitleCache?: ReadonlyMap<string, string>;
  readonly selectedTaskQuestionCount?: number | undefined;
  readonly selectedTaskTodoCount?: number | undefined;
  readonly deletingTaskId: string | null;
  readonly deleteErrorTaskId: string | null;
  readonly isCollapsed?: boolean;
  readonly onToggleCollapse?: () => void;
  readonly onSelectTask: (taskId: string) => void;
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
  selectedTaskId,
  taskDetail,
  selectedTaskDisplayTitle,
  taskTitleCache,
  selectedTaskQuestionCount,
  selectedTaskTodoCount,
  deletingTaskId,
  deleteErrorTaskId,
  isCollapsed = false,
  onToggleCollapse,
  onSelectTask,
  onDeleteTask,
  onRefresh
}: TaskListProps): React.JSX.Element {
  const [collapsedParentIds, setCollapsedParentIds] = useState<ReadonlySet<string>>(new Set());
  const taskTitleById = new Map(
    tasks.map((task) => [task.id, resolveTaskListItemTitle(task, selectedTaskId, selectedTaskDisplayTitle, taskTitleCache)])
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
    <aside className="sidebar-panel">
      <button
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="sidebar-toggle-btn"
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        type="button"
      >
        {isCollapsed ? "›" : "‹"}
      </button>
      <div className="panel-header">
        <p className="eyebrow">Monitor</p>
        <h1>AI CLI Timeline</h1>
        <p className="muted small">Live task observability for parallel agent work.</p>
      </div>

      <button className="ghost-button" onClick={onRefresh} type="button">
        <img src="/icons/refresh.svg" alt="" />
        Refresh Snapshot
      </button>

      <div className="task-list-section">
        <div className="section-heading">
          <span>Tracked Tasks</span>
          <span className="count-badge">{tasks.length}</span>
        </div>

        {tasks.length === 0 ? (
          <div className="empty-card">
            <p>No tasks yet.</p>
            <p className="muted small">
              Send <code>monitor_task_start</code> through the MCP server or POST to{" "}
              <code>/api/task-start</code>.
            </p>
          </div>
        ) : (
          <div className="task-items">
            {displayRows.map(({ task, depth }) => (
              (() => {
                const taskDisplayTitle = resolveTaskListItemTitle(task, selectedTaskId, selectedTaskDisplayTitle, taskTitleCache);
                const childCount = childCountByParentId.get(task.id) ?? 0;
                const hasChildren = childCount > 0;
                const isCollapsedParent = collapsedParentIds.has(task.id);

                return (
              <div
                key={task.id}
                className={`task-item${depth > 0 ? " child" : ""}${task.id === selectedTaskId ? " active" : ""}`}
              >
                {hasChildren ? (
                  <button
                    aria-label={isCollapsedParent ? "Expand child tasks" : "Collapse child tasks"}
                    className="task-tree-toggle"
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
                    type="button"
                  >
                    {isCollapsedParent ? "▸" : "▾"}
                  </button>
                ) : (
                  <span aria-hidden="true" className="task-tree-spacer" />
                )}
                <button
                  className="task-item-body"
                  onClick={() => onSelectTask(task.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                    width: "100%"
                  }}
                  type="button"
                >
                  <div className="task-item-meta">
                    <span className={`status-pill ${task.status}`}>{task.status}</span>
                    <span className="task-age">{formatRelativeTime(task.updatedAt)}</span>
                    {task.runtimeSource && (
                      <span className={`cli-tag cli-tag--${runtimeTagSlug(task.runtimeSource)}`}>
                        {runtimeTagLabel(task.runtimeSource)}
                      </span>
                    )}
                  </div>
                  <div className="task-item-title">
                    {taskDisplayTitle}
                  </div>
                  <div className="task-item-meta" style={{ marginTop: 4 }}>
                    {task.taskKind === "background" ? (
                      <span className="cli-tag cli-tag--opencode">background</span>
                    ) : (
                      <span className="cli-tag">primary</span>
                    )}
                    {task.parentTaskId && (
                      <span className="task-age">
                        parent: {taskTitleById.get(task.parentTaskId) ?? task.parentTaskId.slice(0, 8)}
                      </span>
                    )}
                    {(task.taskKind ?? "primary") === "primary" && childCount > 0 && (
                      <span className="task-signal-pill todos">{childCount} child{childCount === 1 ? "" : "ren"}</span>
                    )}
                  </div>
                  <div className="task-item-path mono">{task.workspacePath ?? "—"}</div>
                  {task.id === selectedTaskId && task.id === taskDetail?.task.id && (
                    <div className="task-item-signals">
                      {selectedTaskQuestionCount !== undefined && selectedTaskQuestionCount > 0 && (
                        <span className="task-signal-pill questions">{selectedTaskQuestionCount}Q</span>
                      )}
                      {selectedTaskTodoCount !== undefined && selectedTaskTodoCount > 0 && (
                        <span className="task-signal-pill todos">{selectedTaskTodoCount} todo{selectedTaskTodoCount === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  )}
                </button>
                <button
                  className="delete-btn"
                  disabled={deletingTaskId === task.id}
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                  style={{
                    color:   deleteErrorTaskId === task.id ? "var(--err)" : undefined,
                    opacity: deletingTaskId    === task.id ? 0.3 : undefined
                  }}
                  title="Delete task"
                  type="button"
                >
                  <img src="/icons/trash.svg" alt="Delete" />
                </button>
              </div>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export function resolveTaskListItemTitle(
  task: MonitoringTask,
  selectedTaskId: string | null,
  selectedTaskDisplayTitle?: string | null,
  titleCache?: ReadonlyMap<string, string>
): string {
  if (task.id === selectedTaskId && selectedTaskDisplayTitle?.trim()) {
    return selectedTaskDisplayTitle;
  }

  const cached = titleCache?.get(task.id);
  if (cached?.trim()) {
    return cached;
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

function runtimeTagLabel(source: string): string {
  if (source === "claude-hook") return "Claude Code";
  if (source === "opencode-plugin") return "OpenCode";
  return source;
}
