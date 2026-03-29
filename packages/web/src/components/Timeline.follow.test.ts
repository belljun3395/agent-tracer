import { describe, expect, it } from "vitest";

import { EventId, TaskId } from "@monitor/core";
import {
  computeTimelineFollowScrollLeft,
  shouldResetTimelineFollowForTaskChange
} from "./Timeline.js";

describe("timeline follow reset", () => {
  it("resets follow mode when the selected task changes", () => {
    expect(shouldResetTimelineFollowForTaskChange({
      previousTaskId: "task-1",
      nextTaskId: "task-2",
      selectedEventId: null,
      timeline: []
    })).toBe(true);
  });

  it("does not reset follow mode when the same task stays selected", () => {
    expect(shouldResetTimelineFollowForTaskChange({
      previousTaskId: "task-1",
      nextTaskId: "task-1",
      selectedEventId: null,
      timeline: []
    })).toBe(false);
  });

  it("does not reset to latest when the next task already has an explicit selected event", () => {
    expect(shouldResetTimelineFollowForTaskChange({
      previousTaskId: "task-1",
      nextTaskId: "task-2",
      selectedEventId: "event-2",
      timeline: [
        {
          id: EventId("event-2"),
          taskId: TaskId("task-2"),
          kind: "tool.used",
          lane: "implementation",
          title: "Pinned event",
          metadata: {},
          classification: { lane: "implementation", tags: [], matches: [] },
          createdAt: "2026-03-18T10:00:00.000Z"
        }
      ]
    })).toBe(false);
  });

  it("computes a right-aligned scroll position for the latest event focus", () => {
    expect(computeTimelineFollowScrollLeft({
      clientWidth: 400,
      scrollWidth: 1600,
      timelineFocusRight: 1200
    })).toBeGreaterThan(0);
  });
});
