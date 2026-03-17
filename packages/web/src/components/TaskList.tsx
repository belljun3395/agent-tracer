/**
 * 사이드바 태스크 목록.
 * 태스크 선택, 삭제 기능 포함.
 * 각 태스크의 상태, 제목, 경로, 마지막 업데이트 시간 표시.
 */

import type React from "react";
import type { MonitoringTask, TaskDetailResponse } from "../types.js";
import { formatRelativeTime } from "../lib/timeline.js";
import { buildTaskDisplayTitle } from "../lib/insights.js";

interface TaskListProps {
  readonly tasks: readonly MonitoringTask[];
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedTaskDisplayTitle?: string | null;
  readonly selectedTaskQuestionCount?: number | undefined;
  readonly selectedTaskTodoCount?: number | undefined;
  readonly deletingTaskId: string | null;
  readonly deleteErrorTaskId: string | null;
  readonly onSelectTask: (taskId: string) => void;
  readonly onDeleteTask: (taskId: string) => void;
  readonly onRefresh: () => void;
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
  selectedTaskQuestionCount,
  selectedTaskTodoCount,
  deletingTaskId,
  deleteErrorTaskId,
  onSelectTask,
  onDeleteTask,
  onRefresh
}: TaskListProps): React.JSX.Element {
  const taskTitleById = new Map(
    tasks.map((task) => [task.id, resolveTaskListItemTitle(task, selectedTaskId, selectedTaskDisplayTitle)])
  );
  const childCountByParentId = new Map<string, number>();

  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const count = childCountByParentId.get(task.parentTaskId) ?? 0;
    childCountByParentId.set(task.parentTaskId, count + 1);
  }

  return (
    <aside className="sidebar-panel">
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
            {tasks.map((task) => (
              (() => {
                const taskDisplayTitle = resolveTaskListItemTitle(task, selectedTaskId, selectedTaskDisplayTitle);

                return (
              <div
                key={task.id}
                className={`task-item${task.id === selectedTaskId ? " active" : ""}`}
              >
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
                    {(task.taskKind ?? "primary") === "primary" && (childCountByParentId.get(task.id) ?? 0) > 0 && (
                      <span className="task-signal-pill todos">{childCountByParentId.get(task.id)} child</span>
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
  selectedTaskDisplayTitle?: string | null
): string {
  if (task.id === selectedTaskId && selectedTaskDisplayTitle?.trim()) {
    return selectedTaskDisplayTitle;
  }

  return buildTaskDisplayTitle(task, []);
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
