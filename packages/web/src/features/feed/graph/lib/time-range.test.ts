import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, TaskId } from "~domain/monitoring.js";
import { buildTimeRange, msToLeftPercent } from "./time-range.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function event(ms: number): TimelineEventRecord {
  return {
    id: EventId(`e${ms}`),
    taskId: TaskId("t"),
    kind: "action.logged",
    lane: "user",
    title: "x",
    metadata: {},
    classification: EMPTY_CLASSIFICATION,
    createdAt: new Date(ms).toISOString(),
  };
}

describe("buildTimeRange", () => {
  it("synthesises a 1-minute window when there are no events", () => {
    const now = 1_000_000_000;
    const range = buildTimeRange([], now);
    expect(range.maxMs).toBe(now);
    expect(range.spanMs).toBe(60_000);
    expect(range.minMs).toBe(now - 60_000);
  });

  it("spans from earliest event to max(now, latest event)", () => {
    const now = 1_000_000_000;
    const range = buildTimeRange(
      [event(now - 100_000), event(now - 50_000)],
      now,
    );
    expect(range.minMs).toBe(now - 100_000);
    expect(range.maxMs).toBe(now);
    expect(range.spanMs).toBe(100_000);
  });

  it("clamps spanMs to a 1-minute floor for short tasks", () => {
    const now = 1_000_000_000;
    const range = buildTimeRange([event(now - 5_000), event(now - 1_000)], now);
    expect(range.spanMs).toBe(60_000);
    expect(range.maxMs).toBe(range.minMs + 60_000);
  });

  it("uses the latest event when it's past `now` (clock skew tolerated)", () => {
    const now = 1_000_000_000;
    const range = buildTimeRange([event(now + 5_000)], now);
    expect(range.maxMs).toBeGreaterThanOrEqual(now + 5_000);
  });
});

describe("msToLeftPercent", () => {
  const range = { minMs: 0, maxMs: 1000, spanMs: 1000 };

  it("maps min/mid/max to 0 / 50 / 100", () => {
    expect(msToLeftPercent(0, range)).toBe(0);
    expect(msToLeftPercent(500, range)).toBe(50);
    expect(msToLeftPercent(1000, range)).toBe(100);
  });

  it("clamps below 0 and above 100", () => {
    expect(msToLeftPercent(-100, range)).toBe(0);
    expect(msToLeftPercent(2000, range)).toBe(100);
  });
});
