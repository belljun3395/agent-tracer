import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, RuntimeSessionId, TaskId } from "~domain/monitoring.js";
import type { TaskTurnSummary } from "~domain/task-query-contracts.js";
import { buildFeedEdges } from "./build-edges.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function event(
  id: string,
  ms: number,
  metadata: Record<string, unknown> = {},
): TimelineEventRecord {
  return {
    id: EventId(id),
    taskId: TaskId("t"),
    kind: "action.logged",
    lane: "user",
    title: id,
    metadata,
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

describe("buildFeedEdges", () => {
  it("returns no edges when there are no events", () => {
    expect(buildFeedEdges([], [])).toEqual([]);
  });

  it("emits an explicit edge when metadata names a parent event", () => {
    const edges = buildFeedEdges(
      [event("a", 0), event("b", 100, { parentEventId: "a" })],
      [],
    );
    expect(edges).toEqual([
      { kind: "explicit", fromEventId: "a", toEventId: "b" },
    ]);
  });

  it("ignores explicit parents that aren't in the visible event set", () => {
    const edges = buildFeedEdges(
      [event("b", 100, { parentEventId: "missing" })],
      [],
    );
    expect(edges).toEqual([]);
  });

  it("chains consecutive events within the same turn", () => {
    const edges = buildFeedEdges(
      [event("a", 100), event("b", 200), event("c", 300)],
      [turn(0, 0, 1000)],
    );
    expect(edges).toEqual([
      { kind: "causal", fromEventId: "a", toEventId: "b" },
      { kind: "causal", fromEventId: "b", toEventId: "c" },
    ]);
  });

  it("chains consecutive events even across turn boundaries", () => {
    // Operators want continuity across turn boundaries; gating on turn
    // membership left orphan nodes when events landed between turns.
    const edges = buildFeedEdges(
      [event("a", 100), event("b", 1500)],
      [turn(0, 0, 1000), turn(1, 1000, 2000)],
    );
    expect(edges).toEqual([
      { kind: "causal", fromEventId: "a", toEventId: "b" },
    ]);
  });

  it("chains consecutive events even when they fall outside every turn", () => {
    const edges = buildFeedEdges(
      [event("a", 100), event("b", 200)],
      [turn(0, 500, 1000)], // both events predate the turn
    );
    expect(edges).toEqual([
      { kind: "causal", fromEventId: "a", toEventId: "b" },
    ]);
  });

  it("dedupes when an explicit edge would also be a chain edge", () => {
    const edges = buildFeedEdges(
      [event("a", 100), event("b", 200, { parentEventId: "a" })],
      [turn(0, 0, 1000)],
    );
    // explicit pass runs first → only one edge with kind 'explicit'
    expect(edges).toEqual([
      { kind: "explicit", fromEventId: "a", toEventId: "b" },
    ]);
  });
});
