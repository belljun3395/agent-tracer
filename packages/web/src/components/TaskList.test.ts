import { describe, expect, it } from "vitest";

import type { MonitoringTask } from "../types.js";
import { buildTaskListRows, resolveTaskListItemTitle } from "./TaskList.js";

const BASE_TASK: MonitoringTask = {
  id: "task-1",
  title: "OpenCode - agent-tracer",
  slug: "agent-tracer",
  workspacePath: "/Users/okestro/Documents/code/agent-tracer",
  status: "running",
  createdAt: "2026-03-16T09:00:00.000Z",
  updatedAt: "2026-03-16T09:01:00.000Z"
};

describe("resolveTaskListItemTitle", () => {
  it("uses the shared selected-task title for the active row", () => {
    expect(resolveTaskListItemTitle(BASE_TASK, "task-1", "Fix the timeline title mismatch")).toBe(
      "Fix the timeline title mismatch"
    );
  });

  it("falls back to the sidebar title for non-selected rows", () => {
    expect(resolveTaskListItemTitle(BASE_TASK, "task-2", "Fix the timeline title mismatch")).toBe(
      "OpenCode - agent-tracer"
    );
  });
});

describe("buildTaskListRows", () => {
  it("groups background child rows directly under their parent", () => {
    const parent: MonitoringTask = {
      ...BASE_TASK,
      id: "parent-1",
      updatedAt: "2026-03-16T09:01:00.000Z"
    };
    const childNewer: MonitoringTask = {
      ...BASE_TASK,
      id: "child-1",
      taskKind: "background",
      parentTaskId: "parent-1",
      updatedAt: "2026-03-16T09:03:00.000Z"
    };
    const rootLatest: MonitoringTask = {
      ...BASE_TASK,
      id: "root-latest",
      updatedAt: "2026-03-16T09:05:00.000Z"
    };

    const rows = buildTaskListRows([childNewer, rootLatest, parent]);

    expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
      ["root-latest", 0],
      ["parent-1", 0],
      ["child-1", 1]
    ]);
  });

  it("treats orphaned child tasks as root rows", () => {
    const orphan: MonitoringTask = {
      ...BASE_TASK,
      id: "orphan-child",
      taskKind: "background",
      parentTaskId: "missing-parent"
    };

    const rows = buildTaskListRows([orphan]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task: { id: "orphan-child" },
      depth: 0
    });
  });

  it("hides children when parent is collapsed", () => {
    const parent: MonitoringTask = {
      ...BASE_TASK,
      id: "parent-1",
      updatedAt: "2026-03-16T09:01:00.000Z"
    };
    const child: MonitoringTask = {
      ...BASE_TASK,
      id: "child-1",
      taskKind: "background",
      parentTaskId: "parent-1",
      updatedAt: "2026-03-16T09:02:00.000Z"
    };

    const rows = buildTaskListRows([parent, child], {
      collapsedParentIds: new Set(["parent-1"])
    });

    expect(rows.map((row) => row.task.id)).toEqual(["parent-1"]);
  });

  it("still groups completed parent and background child", () => {
    const completedParent: MonitoringTask = {
      ...BASE_TASK,
      id: "completed-parent",
      status: "completed",
      updatedAt: "2026-03-16T09:10:00.000Z"
    };
    const completedChild: MonitoringTask = {
      ...BASE_TASK,
      id: "completed-child",
      status: "completed",
      taskKind: "background",
      parentTaskId: "completed-parent",
      updatedAt: "2026-03-16T09:11:00.000Z"
    };

    const rows = buildTaskListRows([completedChild, completedParent]);

    expect(rows.map((row) => [row.task.id, row.depth])).toEqual([
      ["completed-parent", 0],
      ["completed-child", 1]
    ]);
  });
});
