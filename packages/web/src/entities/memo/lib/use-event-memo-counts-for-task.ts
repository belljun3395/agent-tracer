import { useMemo } from "react";
import type { EventId, TaskId } from "~web/shared/identity.js";
import { useMemosQuery } from "~web/entities/memo/api/queries.js";
import { countMemosByEvent } from "~web/entities/memo/lib/count-memos-by-event.js";

/**
 * 태스크와 이벤트를 함께 반환하는 전용 엔드포인트가 없어 사용자 전체 메모 조회 결과를
 * 클라이언트에서 태스크로 필터링해 이벤트별 개수를 유도한다.
 */
export function useEventMemoCountsForTask(taskId: TaskId): ReadonlyMap<EventId, number> {
  const { data } = useMemosQuery();
  return useMemo(() => {
    if (!data) return new Map<EventId, number>();
    return countMemosByEvent(data.memos, taskId) as ReadonlyMap<EventId, number>;
  }, [data, taskId]);
}
