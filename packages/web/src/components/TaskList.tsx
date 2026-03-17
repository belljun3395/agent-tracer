/**
 * 사이드바 태스크 목록.
 * 태스크 선택, 삭제 기능 포함.
 * 각 태스크의 상태, 제목, 경로, 마지막 업데이트 시간 표시.
 */

import type React from "react";
import type { MonitoringTask, TaskDetailResponse } from "../types.js";
import { formatRelativeTime } from "../lib/timeline.js";

interface TaskListProps {
  readonly tasks: readonly MonitoringTask[];
  readonly selectedTaskId: string | null;
  readonly taskDetail: TaskDetailResponse | null;
  readonly selectedTaskDisplayTitle: string | null;
  readonly selectedTaskModelName?: string | undefined;
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
  selectedTaskModelName,
  selectedTaskQuestionCount,
  selectedTaskTodoCount,
  deletingTaskId,
  deleteErrorTaskId,
  onSelectTask,
  onDeleteTask,
  onRefresh
}: TaskListProps): React.JSX.Element {
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
              <div
                key={task.id}
                className={`task-item${task.id === selectedTaskId ? " active" : ""}`}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="task-item-body">
                  <div className="task-item-meta">
                    <span className={`status-pill ${task.status}`}>{task.status}</span>
                    <span className="task-age">{formatRelativeTime(task.updatedAt)}</span>
                  </div>
                  <div className="task-item-title">
                    {task.id === taskDetail?.task.id && selectedTaskDisplayTitle
                      ? selectedTaskDisplayTitle
                      : task.title}
                  </div>
                  <div className="task-item-path mono">{task.workspacePath ?? "—"}</div>
                  {task.id === selectedTaskId && task.id === taskDetail?.task.id && (
                    <div className="task-item-signals">
                      {selectedTaskModelName && (
                        <span className="task-signal-pill model" title="AI model">{selectedTaskModelName}</span>
                      )}
                      {selectedTaskQuestionCount !== undefined && selectedTaskQuestionCount > 0 && (
                        <span className="task-signal-pill questions">{selectedTaskQuestionCount}Q</span>
                      )}
                      {selectedTaskTodoCount !== undefined && selectedTaskTodoCount > 0 && (
                        <span className="task-signal-pill todos">{selectedTaskTodoCount} todo{selectedTaskTodoCount === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  )}
                </div>
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
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
