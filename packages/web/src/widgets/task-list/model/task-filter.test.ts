import { describe, expect, test } from "vitest";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import { TaskId } from "~web/shared/identity.js";
import { countByFilter, filterTasks } from "~web/widgets/task-list/model/task-filter.js";

type TaskFixtureOverrides = Omit<Partial<MonitoringTask>, "id"> & {
  readonly id: string;
  readonly title?: string;
};

function makeTask(overrides: TaskFixtureOverrides): MonitoringTask {
  const { id, ...rest } = overrides;
  return {
    title: `task ${id}`,
    slug: id as MonitoringTask["slug"],
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
    id: id as TaskId,
  };
}

describe("filterTasks", () => {
  const tasks = [
    makeTask({ id: "a", title: "Fix login bug", status: "running" }),
    makeTask({ id: "b", title: "Waiting on review", status: "waiting" }),
    makeTask({ id: "c", title: "Ship release", status: "errored" }),
    makeTask({ id: "d", title: "Cleanup done", status: "completed" }),
  ];

  test("filter=all이고 검색어가 없으면 모든 태스크를 반환한다", () => {
    expect(filterTasks(tasks, "all", "")).toHaveLength(4);
  });

  test("filter=live는 running|waiting만 반환한다", () => {
    expect(filterTasks(tasks, "live", "").map((task) => task.id)).toEqual([
      "a",
      "b",
    ]);
  });

  test("filter=attn은 errored만 반환한다", () => {
    expect(filterTasks(tasks, "attn", "").map((task) => task.id)).toEqual([
      "c",
    ]);
  });

  test("filter=done은 completed만 반환한다", () => {
    expect(filterTasks(tasks, "done", "").map((task) => task.id)).toEqual([
      "d",
    ]);
  });

  test("검색은 title에 대해 대소문자 구분 없는 부분일치다", () => {
    expect(filterTasks(tasks, "all", "LOGIN").map((task) => task.id)).toEqual([
      "a",
    ]);
  });

  test("둘 다 있으면 검색은 title보다 displayTitle을 우선한다", () => {
    const withDisplay = [
      makeTask({
        id: "e",
        title: "raw title",
        displayTitle: "friendly name",
      }),
    ];
    expect(filterTasks(withDisplay, "all", "friendly")).toHaveLength(1);
    expect(filterTasks(withDisplay, "all", "raw")).toHaveLength(0);
  });

  test("filter와 search는 AND 의미로 결합한다", () => {
    expect(filterTasks(tasks, "live", "review").map((task) => task.id)).toEqual([
      "b",
    ]);
  });

  test("검색어가 비어 있으면 상태 필터 외에는 아무것도 걸러내지 않는다", () => {
    expect(filterTasks(tasks, "all", "   ")).toHaveLength(4);
  });

  test("태그 적격 집합을 주면 그 집합에 없는 태스크는 제외한다", () => {
    const eligible = new Set<TaskId>([TaskId("a"), TaskId("c")]);
    expect(filterTasks(tasks, "all", "", eligible).map((task) => task.id)).toEqual([
      "a",
      "c",
    ]);
  });

  test("태그 적격 집합이 null이면 태그로 걸러내지 않는다", () => {
    expect(filterTasks(tasks, "all", "", null)).toHaveLength(4);
  });
});

describe("countByFilter", () => {
  test("각 버킷의 개수를 서로 독립적으로 센다", () => {
    const tasks = [
      makeTask({ id: "a", status: "running" }),
      makeTask({ id: "b", status: "waiting" }),
      makeTask({ id: "c", status: "errored" }),
      makeTask({ id: "d", status: "completed" }),
      makeTask({ id: "e", status: "completed" }),
    ];
    expect(countByFilter(tasks)).toEqual({
      all: 5,
      live: 2,
      attn: 1,
      done: 2,
    });
  });

  test("입력이 비어 있으면 모든 카운트가 0이다", () => {
    expect(countByFilter([])).toEqual({ all: 0, live: 0, attn: 0, done: 0 });
  });
});
