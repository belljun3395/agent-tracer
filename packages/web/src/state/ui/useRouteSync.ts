import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { TaskId } from "~domain/monitoring.js";
import { useMarkTaskRead, useSetSelectedTaskId } from "./hooks.js";

/**
 * One-way URL → store sync. The URL is the source of truth for selection;
 * the store mirrors it so feature components can read taskId without
 * re-running `useParams` on every level. Entering a task route also marks
 * the task as read — that's how the sidebar's unread pulse clears.
 *
 * The reverse direction (store → URL) is handled at click sites — TaskRow
 * uses `<Link to="/tasks/:id">` directly. Keeping it explicit there avoids
 * surprise navigation triggered by store updates.
 */
export function useSyncSelectionFromRoute(): void {
  const { taskId } = useParams<{ taskId: string }>();
  const setSelectedTaskId = useSetSelectedTaskId();
  const markTaskRead = useMarkTaskRead();

  useEffect(() => {
    const branded = taskId ? TaskId(taskId) : null;
    setSelectedTaskId(branded);
    if (branded) {
      markTaskRead(branded);
    }
  }, [taskId, setSelectedTaskId, markTaskRead]);
}
