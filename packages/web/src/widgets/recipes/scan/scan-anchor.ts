import type { RecipesResponse } from "~web/entities/recipe/model/recipe.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";

/** 레시피의 근거(contributingSlices)로 인용된 적이 있는 태스크 id 집합. */
/** 레시피 이력에서 이미 스캔한 태스크를 수집한다. */
export function collectScannedTaskIds(
  responses: readonly (RecipesResponse | undefined)[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const response of responses) {
    for (const recipe of response?.recipes ?? []) {
      for (const slice of recipe.contributingSlices) ids.add(slice.taskId);
    }
  }
  return ids;
}

/** 앵커 피커의 제목 검색. */
export function filterAnchorTasks(
  tasks: readonly MonitoringTask[],
  query: string,
): readonly MonitoringTask[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return tasks;
  return tasks.filter((task) =>
    (task.displayTitle ?? task.title).toLowerCase().includes(needle),
  );
}
