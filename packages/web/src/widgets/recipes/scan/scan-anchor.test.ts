import { describe, expect, it } from "vitest";
import type { RecipesResponse } from "~web/entities/recipe/model/recipe.js";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { collectScannedTaskIds, filterAnchorTasks } from "~web/widgets/recipes/scan/scan-anchor.js";

function makeTask(id: string, title: string, displayTitle?: string): MonitoringTask {
  return {
    id: id as TaskId,
    title,
    slug: id as MonitoringTask["slug"],
    status: "completed",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...(displayTitle !== undefined ? { displayTitle } : {}),
  };
}

function makeResponse(slices: readonly (readonly string[])[]): RecipesResponse {
  return {
    recipes: slices.map((taskIds, index) => ({
      id: `recipe-${index}`,
      contributingSlices: taskIds.map((taskId) => ({ taskId: taskId as TaskId, eventIds: [] })),
    })) as unknown as RecipesResponse["recipes"],
    taskTitleById: new Map(),
  };
}

describe("스캔 완료 태스크 수집", () => {
  it("여러 응답의 슬라이스 taskId를 하나의 집합으로 모은다", () => {
    const ids = collectScannedTaskIds([makeResponse([["t1", "t2"]]), makeResponse([["t2", "t3"]])]);
    expect([...ids].sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("아직 로드되지 않은 응답은 건너뛴다", () => {
    expect(collectScannedTaskIds([undefined, makeResponse([["t1"]])])).toEqual(new Set(["t1"]));
  });

  it("레시피가 없으면 빈 집합을 반환한다", () => {
    expect(collectScannedTaskIds([makeResponse([])]).size).toBe(0);
  });
});

describe("filterAnchorTasks", () => {
  const tasks = [makeTask("t1", "원본 제목", "모니터링 스택 정리"), makeTask("t2", "Temporal 관찰성")];

  it("공백만 있는 질의는 전체를 통과시킨다", () => {
    expect(filterAnchorTasks(tasks, "   ")).toHaveLength(2);
  });

  it("displayTitle이 있으면 그것을 기준으로 찾는다", () => {
    expect(filterAnchorTasks(tasks, "모니터링").map((t) => t.id)).toEqual(["t1"]);
  });

  it("원본 title이 일치해도 displayTitle이 있으면 걸리지 않는다", () => {
    expect(filterAnchorTasks(tasks, "원본")).toHaveLength(0);
  });

  it("대소문자를 구분하지 않는다", () => {
    expect(filterAnchorTasks(tasks, "temporal").map((t) => t.id)).toEqual(["t2"]);
  });
});
