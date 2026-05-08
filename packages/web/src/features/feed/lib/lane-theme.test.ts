import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
  TimelineLane,
} from "~domain/monitoring.js";
import { EventId, TaskId } from "~domain/monitoring.js";
import { laneThemeFor, laneThemeForEvent } from "./lane-theme.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function makeEvent(
  overrides: Partial<TimelineEventRecord> & {
    lane: TimelineLane;
    kind: TimelineEventRecord["kind"];
  },
): TimelineEventRecord {
  return {
    id: EventId("e"),
    taskId: TaskId("t"),
    title: "x",
    metadata: {},
    classification: { ...EMPTY_CLASSIFICATION, lane: overrides.lane },
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("laneThemeFor", () => {
  it.each<[TimelineLane, string]>([
    ["user", "USER"],
    ["planning", "PLAN"],
    ["exploration", "EXPL"],
    ["implementation", "IMPL"],
    ["rule", "RULE"],
    ["coordination", "COORD"],
    ["background", "BG"],
    ["telemetry", "BG"],
    ["questions", "RULE"],
    ["todos", "PLAN"],
  ])("maps domain lane %s to v6 label %s", (lane, label) => {
    expect(laneThemeFor(lane).label).toBe(label);
  });
});

describe("laneThemeForEvent", () => {
  it("falls back to lane-based mapping for non-verification events", () => {
    const event = makeEvent({ kind: "action.logged", lane: "implementation" });
    expect(laneThemeForEvent(event).key).toBe("impl");
    expect(laneThemeForEvent(event).label).toBe("IMPL");
  });

  it("forces VERI lane for verification.logged events even when domain says rule", () => {
    const event = makeEvent({ kind: "verification.logged", lane: "rule" });
    const theme = laneThemeForEvent(event);
    expect(theme.key).toBe("veri");
    expect(theme.label).toBe("VERI");
    expect(theme.cssColor).toBe("var(--ph-veri)");
  });

  it("forces VERI lane for verification.logged events regardless of domain lane", () => {
    const event = makeEvent({
      kind: "verification.logged",
      lane: "implementation",
    });
    expect(laneThemeForEvent(event).key).toBe("veri");
  });
});
