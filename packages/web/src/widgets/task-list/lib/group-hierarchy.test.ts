import { describe, expect, test } from "vitest";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { groupHierarchically, type HierarchicalTaskGroup } from "~web/widgets/task-list/lib/group-hierarchy.js";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");

type TaskFixtureOverrides = Omit<Partial<MonitoringTask>, "id" | "parentTaskId"> & {
  readonly id: string;
  readonly parentTaskId?: string;
};

function makeTask(overrides: TaskFixtureOverrides): MonitoringTask {
  const { id, parentTaskId, ...rest } = overrides;
  return {
    title: `task ${id}`,
    slug: id as MonitoringTask["slug"],
    status: "completed",
    createdAt: "2026-06-15T09:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
    ...rest,
    id: id as TaskId,
    ...(parentTaskId ? { parentTaskId: parentTaskId as TaskId } : {}),
  };
}

function rowIds(groups: readonly HierarchicalTaskGroup[], key: string): string[] {
  const g = groups.find((grp) => grp.key === key);
  return (g?.rows ?? []).map((r) => r.task.id);
}

describe("groupHierarchically", () => {
  test("완료된 부모와 running 자식이 시간대가 달라도 부모 서브트리로 함께 렌더된다", () => {
    // 실제 버그 재현: 부모는 오늘 완료, 자식은 어제부터 running 고착.
    const parent = makeTask({ id: "parent", status: "completed", updatedAt: "2026-06-15T10:00:00.000Z" });
    const child = makeTask({
      id: "child",
      parentTaskId: "parent",
      status: "running",
      updatedAt: "2026-06-14T10:00:00.000Z",
    });
    const groups = groupHierarchically([parent, child], new Set(), NOW);

    // 자식이 running이라 서브트리 전체가 Live 버킷으로 올라가고, 자식은 부모 밑에 중첩된다.
    expect(rowIds(groups, "live")).toEqual(["parent", "child"]);
    // 자식이 독립 루트로 다른 버킷에 튀지 않는다.
    expect(rowIds(groups, "yesterday")).toEqual([]);
    const parentRow = groups.find((g) => g.key === "live")?.rows[0];
    const childRow = groups.find((g) => g.key === "live")?.rows[1];
    expect(parentRow).toMatchObject({ depth: 0, hasChildren: true });
    expect(childRow).toMatchObject({ depth: 1 });
  });

  test("모두 완료된 서브트리는 서브트리 최신 updatedAt 버킷에 통째로 배치된다", () => {
    const parent = makeTask({ id: "parent", status: "completed", updatedAt: "2026-06-01T10:00:00.000Z" });
    const child = makeTask({
      id: "child",
      parentTaskId: "parent",
      status: "completed",
      updatedAt: "2026-06-15T10:00:00.000Z",
    });
    const groups = groupHierarchically([parent, child], new Set(), NOW);
    // 자식의 최신 updatedAt(오늘)이 서브트리 버킷을 today로 끌어올린다.
    expect(rowIds(groups, "today")).toEqual(["parent", "child"]);
    expect(rowIds(groups, "older")).toEqual([]);
  });

  test("여러 루트는 각 버킷 안에서 서브트리 최신순으로 정렬된다", () => {
    const a = makeTask({ id: "a", status: "completed", updatedAt: "2026-06-15T08:00:00.000Z" });
    const b = makeTask({ id: "b", status: "completed", updatedAt: "2026-06-15T11:00:00.000Z" });
    const groups = groupHierarchically([a, b], new Set(), NOW);
    expect(rowIds(groups, "today")).toEqual(["b", "a"]);
  });

  test("부모가 집합에 없으면 고아 자식은 자기 시각의 루트로 렌더된다", () => {
    const orphan = makeTask({
      id: "orphan",
      parentTaskId: "missing",
      status: "completed",
      updatedAt: "2026-06-14T10:00:00.000Z",
    });
    const groups = groupHierarchically([orphan], new Set(), NOW);
    expect(rowIds(groups, "yesterday")).toEqual(["orphan"]);
  });

  test("접힌 부모는 자식을 숨기지만 숨은 running 자식도 서브트리를 Live로 끌어올린다", () => {
    const parent = makeTask({ id: "parent", status: "completed", updatedAt: "2026-06-01T10:00:00.000Z" });
    const child = makeTask({
      id: "child",
      parentTaskId: "parent",
      status: "running",
      updatedAt: "2026-06-14T10:00:00.000Z",
    });
    const groups = groupHierarchically([parent, child], new Set(["parent"]), NOW);
    expect(rowIds(groups, "live")).toEqual(["parent"]);
    expect(groups.find((g) => g.key === "live")?.rows[0]).toMatchObject({ hasChildren: true });
  });

  test("빈 입력은 빈 그룹을 반환한다", () => {
    expect(groupHierarchically([], new Set(), NOW)).toEqual([]);
  });
});
