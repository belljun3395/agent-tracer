import { describe, expect, it } from "vitest";

import type { TimelineEvent } from "@monitor/core";
import {
  buildLaneSections,
  buildPlanSection
} from "../../src/application/workflow-context-builder.helpers.js";

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: overrides.id ?? "event-1",
    taskId: overrides.taskId ?? "task-1",
    kind: overrides.kind ?? "context.saved",
    lane: overrides.lane ?? "planning",
    title: overrides.title ?? "Context saved",
    metadata: overrides.metadata ?? {},
    classification: overrides.classification ?? {
      lane: overrides.lane ?? "planning",
      tags: [],
      matches: []
    },
    createdAt: overrides.createdAt ?? "2026-03-28T00:00:00.000Z",
    ...overrides
  };
}

describe("workflow context builder", () => {
  it("plan section prefers body/detail over generic titles", () => {
    const section = buildPlanSection([
      makeEvent({
        body: "Inspect README wording and update workflow search ranking."
      })
    ]);

    expect(section).toContain("Inspect README wording and update workflow search ranking.");
    expect(section).not.toContain("- Context saved");
  });

  it("lane sections include metadata descriptions and terminal commands", () => {
    const sections = buildLaneSections([
      makeEvent({
        id: "event-implementation",
        kind: "terminal.command",
        lane: "implementation",
        title: "Terminal command",
        metadata: {
          command: "npm test --workspace @monitor/server",
          description: "Run targeted server regression tests"
        },
        classification: {
          lane: "implementation",
          tags: [],
          matches: []
        }
      })
    ]);

    expect(sections[0]).toContain("Run targeted server regression tests");
    expect(sections[0]).not.toContain("- Terminal command");
  });
});
