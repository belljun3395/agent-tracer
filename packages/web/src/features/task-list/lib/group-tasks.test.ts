import { describe, expect, it } from "vitest";
import type { MonitoringTask } from "~domain/monitoring.js";
import { TaskId, TaskSlug } from "~domain/monitoring.js";
import { groupTasksByTime } from "./group-tasks.js";

/*
 * Anchors built from local Date components so the test is timezone-portable.
 * groupTasksByTime calculates its day boundary in local time, so the test
 * fixtures must too — otherwise running in KST vs UTC produces different
 * groupings.
 */
const NOW = new Date(2026, 4, 8, 15, 0, 0).getTime(); // 2026-05-08 15:00 local
const todayAt = (h: number, m = 0): number =>
  new Date(2026, 4, 8, h, m).getTime();
const yesterdayAt = (h: number): number =>
  new Date(2026, 4, 7, h, 0).getTime();

function task(
  id: string,
  status: MonitoringTask["status"],
  updatedAtMs: number,
): MonitoringTask {
  return {
    id: TaskId(id),
    title: id,
    slug: TaskSlug(id),
    status,
    createdAt: new Date(updatedAtMs).toISOString(),
    updatedAt: new Date(updatedAtMs).toISOString(),
  };
}

describe("groupTasksByTime", () => {
  it("returns an empty array when there are no tasks", () => {
    expect(groupTasksByTime([], NOW)).toEqual([]);
  });

  it("pins running and waiting tasks to the Live group regardless of timestamp", () => {
    const old = task("a", "running", yesterdayAt(3));
    const recent = task("b", "completed", todayAt(14));
    const groups = groupTasksByTime([old, recent], NOW);
    const liveGroup = groups.find((g) => g.key === "live");
    const todayGroup = groups.find((g) => g.key === "today");
    expect(liveGroup?.tasks.map((t) => t.id)).toEqual(["a"]);
    expect(todayGroup?.tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("places completed tasks updated today into the Today group", () => {
    const groups = groupTasksByTime(
      [task("x", "completed", todayAt(2))],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("today");
  });

  it("places yesterday's completed tasks into Yesterday", () => {
    const groups = groupTasksByTime(
      [task("y", "completed", yesterdayAt(20))],
      NOW,
    );
    expect(groups[0]?.key).toBe("yesterday");
  });

  it("places older tasks into Older", () => {
    const lastWeek = NOW - 5 * 24 * 3600_000;
    const groups = groupTasksByTime(
      [task("z", "completed", lastWeek)],
      NOW,
    );
    expect(groups[0]?.key).toBe("older");
  });

  it("sorts each group by updatedAt descending", () => {
    const t1 = task("first", "completed", todayAt(2));
    const t2 = task("second", "completed", todayAt(10));
    const t3 = task("third", "completed", todayAt(8));
    const groups = groupTasksByTime([t1, t2, t3], NOW);
    expect(groups[0]?.tasks.map((t) => t.id)).toEqual(["second", "third", "first"]);
  });

  it("drops empty groups so headers never read 'Yesterday (0)'", () => {
    const groups = groupTasksByTime(
      [task("only", "running", todayAt(1))],
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["live"]);
  });
});
