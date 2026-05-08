import { describe, expect, it } from "vitest";
import type { MonitoringTask } from "~domain/monitoring.js";
import { TaskId, TaskSlug } from "~domain/monitoring.js";
import { isTaskUnread } from "./unread.js";

function makeTask(id: string, updatedAtMs: number): MonitoringTask {
  return {
    id: TaskId(id),
    title: id,
    slug: TaskSlug(id),
    status: "running",
    createdAt: new Date(updatedAtMs).toISOString(),
    updatedAt: new Date(updatedAtMs).toISOString(),
  };
}

describe("isTaskUnread", () => {
  const updatedAt = 1_000_000;

  it("is unread when never seen", () => {
    const t = makeTask("a", updatedAt);
    expect(isTaskUnread(t, {})).toBe(true);
  });

  it("is read when seen at or after updatedAt", () => {
    const t = makeTask("a", updatedAt);
    expect(isTaskUnread(t, { a: updatedAt })).toBe(false);
    expect(isTaskUnread(t, { a: updatedAt + 1 })).toBe(false);
  });

  it("is unread when updatedAt has advanced past the last seen timestamp", () => {
    const t = makeTask("a", updatedAt + 100);
    expect(isTaskUnread(t, { a: updatedAt })).toBe(true);
  });
});
