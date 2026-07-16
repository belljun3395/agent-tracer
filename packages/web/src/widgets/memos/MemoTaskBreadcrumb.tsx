import { Link } from "react-router-dom";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";

export function MemoTaskBreadcrumb({
  taskId,
  task,
}: {
  readonly taskId: TaskId;
  readonly task: MonitoringTask | null;
}) {
  const label = task ? task.displayTitle ?? task.title : `${taskId.slice(0, 8)}…`;
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="text-ink-tertiary">task ·</span>
      <Link
        to={`/tasks/${taskId}`}
        title={task ? `Open ${task.title}` : `Open task ${taskId}`}
        className="text-ink-muted underline decoration-dotted underline-offset-2 max-w-60 truncate inline-block align-bottom"
      >
        {label}
      </Link>
      {!task && (
        <span
          title="Task no longer exists or hasn't been loaded yet"
          className="text-ink-tertiary text-[10px]"
        >
          (missing)
        </span>
      )}
    </span>
  );
}
