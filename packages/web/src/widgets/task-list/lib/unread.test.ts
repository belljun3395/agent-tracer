import { describe, expect, test } from "vitest";
import type { MonitoringTask } from "~web/entities/task/model/task.js";
import type { TaskId } from "~web/shared/identity.js";
import { isTaskUnread } from "~web/widgets/task-list/lib/unread.js";

function makeTask(id: string, updatedAt: string): MonitoringTask {
  return {
    id: id as TaskId,
    title: `task ${id}`,
    slug: id as MonitoringTask["slug"],
    status: "running",
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("isTaskUnread", () => {
  test("한 번도 본 적 없는 태스크는 안 읽음이다", () => {
    const task = makeTask("a", "2026-01-01T00:00:00.000Z");
    expect(isTaskUnread(task, {})).toBe(true);
  });

  test("lastSeenAt 이후에 업데이트된 태스크는 안 읽음이다", () => {
    const task = makeTask("a", "2026-01-02T00:00:00.000Z");
    const lastSeenAt = { a: Date.parse("2026-01-01T00:00:00.000Z") };
    expect(isTaskUnread(task, lastSeenAt)).toBe(true);
  });

  test("정확히 lastSeenAt 시점에 업데이트된 태스크는 읽음이다(경계는 배타적)", () => {
    const ts = Date.parse("2026-01-01T00:00:00.000Z");
    const task = makeTask("a", new Date(ts).toISOString());
    expect(isTaskUnread(task, { a: ts })).toBe(false);
  });

  test("lastSeenAt 이전에 업데이트된 태스크는 읽음이다", () => {
    const task = makeTask("a", "2026-01-01T00:00:00.000Z");
    const lastSeenAt = { a: Date.parse("2026-01-02T00:00:00.000Z") };
    expect(isTaskUnread(task, lastSeenAt)).toBe(false);
  });

  test("다른 태스크 id의 lastSeenAt 항목은 이 태스크의 읽음 상태에 영향을 주지 않는다", () => {
    const task = makeTask("a", "2026-01-01T00:00:00.000Z");
    const lastSeenAt = { b: Date.parse("2020-01-01T00:00:00.000Z") };
    expect(isTaskUnread(task, lastSeenAt)).toBe(true);
  });
});
