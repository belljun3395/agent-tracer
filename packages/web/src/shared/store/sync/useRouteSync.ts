import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { EventId, TaskId } from "~web/shared/identity.js";
import { useMarkTaskRead, useSetSelectedEventId, useSetSelectedTaskId } from "~web/shared/store/hooks.js";

/** URL → store 단방향 동기화. */
export function useSyncSelectionFromRoute(): void {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const eventParam = searchParams.get("event");
  const setSelectedTaskId = useSetSelectedTaskId();
  const setSelectedEventId = useSetSelectedEventId();
  const markTaskRead = useMarkTaskRead();

  useEffect(() => {
    const branded = taskId ? TaskId(taskId) : null;
    setSelectedTaskId(branded);
    setSelectedEventId(eventParam ? EventId(eventParam) : null);
    if (branded) {
      markTaskRead(branded);
    }
  }, [taskId, eventParam, setSelectedTaskId, setSelectedEventId, markTaskRead]);
}
