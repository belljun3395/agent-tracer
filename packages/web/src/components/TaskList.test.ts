import { describe, expect, it } from "vitest";

import type { MonitoringTask } from "../types.js";
import { resolveTaskListItemTitle } from "./TaskList.js";

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
