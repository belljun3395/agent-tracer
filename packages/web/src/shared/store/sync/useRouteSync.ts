import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { TaskId } from "~web/shared/identity.js";
import { useMarkTaskRead, useSetSelectedTaskId } from "~web/shared/store/hooks.js";

/** URL → store 단방향 동기화. */
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
