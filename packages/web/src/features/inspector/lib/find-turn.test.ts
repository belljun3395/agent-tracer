import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, RuntimeSessionId, TaskId } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import { findTurnForEvent } from "./find-turn.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function eventAt(ms: number): TimelineEventRecord {
  return {
    id: EventId("e"),
    taskId: TaskId("t"),
    kind: "action.logged",
    lane: "user",
    title: "x",
    metadata: {},
    classification: EMPTY_CLASSIFICATION,
    createdAt: new Date(ms).toISOString(),
  };
}

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

describe("findTurnForEvent", () => {
  it("returns undefined when there are no turns", () => {
    expect(findTurnForEvent(eventAt(100), [])).toBeUndefined();
  });

  it("matches an event inside a closed turn window", () => {
    const t1 = turn(0, 0, 1000);
    const t2 = turn(1, 1000, 2000);
    expect(findTurnForEvent(eventAt(500), [t1, t2])?.turnIndex).toBe(0);
    expect(findTurnForEvent(eventAt(1500), [t1, t2])?.turnIndex).toBe(1);
  });

  it("treats startedAt as inclusive (event at exactly start belongs to that turn)", () => {
    const t1 = turn(0, 0, 1000);
    expect(findTurnForEvent(eventAt(0), [t1])?.turnIndex).toBe(0);
  });

  it("treats endedAt as exclusive (event at exactly end falls into the next turn)", () => {
    const t1 = turn(0, 0, 1000);
    const t2 = turn(1, 1000, 2000);
    expect(findTurnForEvent(eventAt(1000), [t1, t2])?.turnIndex).toBe(1);
  });

  it("treats open turns (endedAt=null) as half-open up to +Infinity", () => {
    const open = turn(0, 0, null);
    expect(findTurnForEvent(eventAt(1_000_000), [open])?.turnIndex).toBe(0);
  });

  it("returns undefined when event predates the first turn", () => {
    const t1 = turn(0, 100, 200);
    expect(findTurnForEvent(eventAt(0), [t1])).toBeUndefined();
  });
});
