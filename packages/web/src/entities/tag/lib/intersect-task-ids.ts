import type { TaskId } from "~web/shared/identity.js";

/** GitHub 라벨 필터처럼 선택된 태그를 전부 가진 태스크만 남기려고 태스크 id 집합을 교집합한다. */
export function intersectTaskIdSets(
  sets: readonly ReadonlySet<TaskId>[],
): ReadonlySet<TaskId> {
  if (sets.length === 0) return new Set<TaskId>();

  const [first, ...rest] = sets as [ReadonlySet<TaskId>, ...ReadonlySet<TaskId>[]];
  const result = new Set<TaskId>();
  for (const taskId of first) {
    if (rest.every((set) => set.has(taskId))) {
      result.add(taskId);
    }
  }
  return result;
}
