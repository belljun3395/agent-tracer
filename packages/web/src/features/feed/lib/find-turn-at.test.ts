import { describe, expect, it } from "vitest";
import { RuntimeSessionId } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import { findTurnAtMs } from "./find-turn-at.js";

function turn(
  index: number,
  startMs: number,
  endMs: number | null,
): TaskTurnSummary {
  return {
    id: `turn-${index}`,
    sessionId: RuntimeSessionId("sess"),
    taskId: "t",
    turnIndex: index,
    status: endMs === null ? "open" : "closed",
    startedAt: new Date(startMs).toISOString(),
    endedAt: endMs === null ? null : new Date(endMs).toISOString(),
    aggregateVerdict: null,
    rulesEvaluatedCount: 0,
  };
}

describe("findTurnAtMs (default: STRICT)", () => {
  it("returns undefined when there are no turns", () => {
    expect(findTurnAtMs(100, [])).toBeUndefined();
  });

  it("matches inside [start, end)", () => {
    const t1 = turn(0, 0, 1000);
    expect(findTurnAtMs(0, [t1])?.turnIndex).toBe(0);
    expect(findTurnAtMs(500, [t1])?.turnIndex).toBe(0);
    expect(findTurnAtMs(999, [t1])?.turnIndex).toBe(0);
  });

  it("end is exclusive — ms === endedAt belongs to next turn (not this one)", () => {
    const t1 = turn(0, 0, 1000);
    const t2 = turn(1, 1000, 2000);
    expect(findTurnAtMs(1000, [t1, t2])?.turnIndex).toBe(1);
  });

  it("returns undefined for ms in a gap between two closed turns (STRICT)", () => {
    const t1 = turn(0, 0, 100);
    const t2 = turn(1, 200, 300);
    expect(findTurnAtMs(150, [t1, t2])).toBeUndefined();
  });

  it("treats open turns as ending at +Infinity", () => {
    const open = turn(0, 0, null);
    expect(findTurnAtMs(1_000_000, [open])?.turnIndex).toBe(0);
  });
});
