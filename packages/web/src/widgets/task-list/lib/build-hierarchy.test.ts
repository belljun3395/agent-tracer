import { describe, expect, test } from "vitest";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { buildHierarchy } from "~web/widgets/task-list/lib/build-hierarchy.js";

type TaskFixtureOverrides = Omit<Partial<MonitoringTask>, "id" | "parentTaskId"> & {
  readonly id: string;
  readonly parentTaskId?: string;
};

function makeTask(overrides: TaskFixtureOverrides): MonitoringTask {
  const { id, parentTaskId, ...rest } = overrides;
  return {
    title: `task ${id}`,
    slug: id as MonitoringTask["slug"],
    status: "running",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...rest,
    id: id as TaskId,
    ...(parentTaskId ? { parentTaskId: parentTaskId as TaskId } : {}),
  };
}

describe("buildHierarchy", () => {
  test("루트만 있는 평평한 목록은 입력 순서 그대로 depth 0에 유지된다", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })];
    const out = buildHierarchy(tasks, new Set());
    expect(out.map((h) => [h.task.id, h.depth, h.hasChildren])).toEqual([
      ["a", 0, false],
      ["b", 0, false],
      ["c", 0, false],
    ]);
  });

  test("자식은 부모 바로 뒤에 들여쓰기되어 삽입된다", () => {
    const tasks = [
      makeTask({ id: "parent" }),
      makeTask({ id: "sibling" }),
      makeTask({ id: "child", parentTaskId: "parent" }),
    ];
    const out = buildHierarchy(tasks, new Set());
    expect(out.map((h) => h.task.id)).toEqual(["parent", "child", "sibling"]);
    expect(out.find((h) => h.task.id === "parent")).toMatchObject({ depth: 0, hasChildren: true });
    expect(out.find((h) => h.task.id === "child")).toMatchObject({ depth: 1, hasChildren: false });
  });

  test("다단계 중첩은 레벨마다 depth를 증가시킨다", () => {
    const tasks = [
      makeTask({ id: "root" }),
      makeTask({ id: "mid", parentTaskId: "root" }),
      makeTask({ id: "leaf", parentTaskId: "mid" }),
    ];
    const out = buildHierarchy(tasks, new Set());
    expect(out.map((h) => [h.task.id, h.depth])).toEqual([
      ["root", 0],
      ["mid", 1],
      ["leaf", 2],
    ]);
  });

  test("접힌 부모는 자손을 숨기지만 hasChildren은 true를 유지한다", () => {
    const tasks = [
      makeTask({ id: "parent" }),
      makeTask({ id: "child", parentTaskId: "parent" }),
    ];
    const out = buildHierarchy(tasks, new Set(["parent"]));
    expect(out.map((h) => h.task.id)).toEqual(["parent"]);
    expect(out[0]).toMatchObject({ hasChildren: true });
  });

  test("깊은 서브트리를 접으면 직계 자식뿐 아니라 그 아래 전체를 숨긴다", () => {
    const tasks = [
      makeTask({ id: "root" }),
      makeTask({ id: "mid", parentTaskId: "root" }),
      makeTask({ id: "leaf", parentTaskId: "mid" }),
    ];
    const out = buildHierarchy(tasks, new Set(["root"]));
    expect(out.map((h) => h.task.id)).toEqual(["root"]);
  });

  test("부모가 가시 집합에서 걸러진 고아 태스크는 루트로 취급한다", () => {
    const tasks = [makeTask({ id: "orphan", parentTaskId: "missing-parent" })];
    const out = buildHierarchy(tasks, new Set());
    expect(out).toEqual([{ task: tasks[0], depth: 0, hasChildren: false }]);
  });

  test("parentTaskId가 순환 참조여도 무한루프 없이 각 태스크를 한 번씩만 낸다", () => {
    const tasks = [
      makeTask({ id: "a", parentTaskId: "b" }),
      makeTask({ id: "b", parentTaskId: "a" }),
    ];
    const out = buildHierarchy(tasks, new Set());
    expect(out).toHaveLength(2);
    expect(new Set(out.map((h) => h.task.id))).toEqual(new Set(["a", "b"]));
  });

  test("빈 입력은 빈 출력을 반환한다", () => {
    expect(buildHierarchy([], new Set())).toEqual([]);
  });
});
