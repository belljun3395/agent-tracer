import type { TaskId } from "~web/shared/identity.js";
import type { MemoRecord } from "~web/entities/memo/model/memo.js";

/** 한 태스크에 속한 이벤트 메모를 이벤트별로 세어 그래프·피드 배지가 읽는다. */
export function countMemosByEvent(
  memos: readonly MemoRecord[],
  taskId: TaskId,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const memo of memos) {
    if (memo.taskId !== taskId || memo.eventId === null) continue;
    counts.set(memo.eventId, (counts.get(memo.eventId) ?? 0) + 1);
  }
  return counts;
}
