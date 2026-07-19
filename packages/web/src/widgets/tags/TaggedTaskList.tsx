import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TagId, TaskId } from "~web/shared/identity.js";
import { useTasksByTagQuery } from "~web/entities/tag/api/queries.js";
import { useTasksQuery } from "~web/entities/task/api/list-queries.js";

interface TaggedTaskListProps {
  readonly tagId: TagId;
}

/** 태그 하나에 붙은 태스크 전부를 나열하는 "태그로 모아보기" 뷰다. */
export function TaggedTaskList({ tagId }: TaggedTaskListProps) {
  const tasksByTagQ = useTasksByTagQuery(tagId);
  const tasksQ = useTasksQuery();

  const taskById = useMemo(() => {
    const map = new Map<TaskId, MonitoringTask>();
    for (const task of tasksQ.data?.tasks ?? []) map.set(task.id, task);
    return map;
  }, [tasksQ.data]);

  if (tasksByTagQ.isLoading) {
    return <p className="px-4 pb-4 text-[12.5px] text-ink-subtle">Loading tasks…</p>;
  }
  if (tasksByTagQ.isError) {
    return <p className="px-4 pb-4 text-[12.5px] text-err">Couldn't load tasks.</p>;
  }

  const taskIds = tasksByTagQ.data?.taskIds ?? [];
  if (taskIds.length === 0) {
    return <p className="px-4 pb-4 text-[12.5px] text-ink-subtle">No tasks carry this tag.</p>;
  }

  return (
    <div className="px-4 pb-4 flex flex-col gap-1.5">
      {taskIds.map((taskId) => {
        const task = taskById.get(taskId);
        return (
          <Link
            key={taskId}
            to={`/tasks/${taskId}`}
            className="rounded-xs border border-hair bg-s1 px-2.5 py-2 text-[12.5px] text-ink hover:bg-s2 truncate"
          >
            {task ? (task.displayTitle ?? task.title) : `${taskId.slice(0, 8)}…`}
          </Link>
        );
      })}
    </div>
  );
}
