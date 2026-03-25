import { describe, expect, it } from "vitest";

import type { TimelineEvent } from "../types.js";
import {
  buildDisplayLaneRows,
  countLaneSubtypes,
  resolveEventSubtype,
  resolveTimelineRowKey
} from "./eventSubtype.js";

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? "event-1",
    taskId: overrides.taskId ?? "task-1",
    kind: overrides.kind ?? "tool.used",
    lane: overrides.lane ?? "implementation",
    title: overrides.title ?? "Event",
    metadata: overrides.metadata ?? {},
    classification: overrides.classification ?? {
      lane: overrides.lane ?? "implementation",
      tags: [],
      matches: []
    },
    createdAt: overrides.createdAt ?? "2026-03-16T09:00:00.000Z",
    ...overrides
  };
}

describe("resolveEventSubtype", () => {
  it("prefers explicit subtype metadata when present", () => {
    const subtype = resolveEventSubtype(makeEvent({
      lane: "implementation",
      metadata: {
        subtypeKey: "run_test",
        subtypeLabel: "Run test",
        entityType: "command",
        entityName: "npm"
      }
    }));

    expect(subtype).toEqual({
      key: "run_test",
      label: "Run test",
      icon: "🧪",
      entityType: "command",
      entityName: "npm"
    });
  });
});

describe("buildDisplayLaneRows", () => {
  it("expands implementation into subtype rows when requested", () => {
    const events = [
      makeEvent({
        id: "test",
        lane: "implementation",
        metadata: { subtypeKey: "run_test", subtypeLabel: "Run test" }
      }),
      makeEvent({
        id: "lint",
        lane: "implementation",
        metadata: { subtypeKey: "run_lint", subtypeLabel: "Run lint" }
      })
    ];

    const rows = buildDisplayLaneRows(events, ["implementation"], new Set(["implementation"]));

    expect(rows).toEqual([
      { key: "implementation:run_test", baseLane: "implementation", isSubtype: true, subtypeKey: "run_test", subtypeLabel: "Run test" },
      { key: "implementation:run_lint", baseLane: "implementation", isSubtype: true, subtypeKey: "run_lint", subtypeLabel: "Run lint" }
    ]);
  });

  it("routes subtype events into the matching expanded row key", () => {
    const event = makeEvent({
      lane: "coordination",
      metadata: { subtypeKey: "mcp_call", subtypeLabel: "MCP call" }
    });

    expect(resolveTimelineRowKey(event, new Set(["coordination"]))).toBe("coordination:mcp_call");
    expect(countLaneSubtypes([event], "coordination")).toBe(1);
  });
});
