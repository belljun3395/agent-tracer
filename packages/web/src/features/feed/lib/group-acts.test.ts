import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, TaskId } from "~domain/monitoring.js";
import { buildFeed } from "./group-acts.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function event(
  id: string,
  kind: TimelineEventRecord["kind"],
  ms: number,
  metadata: Record<string, unknown> = {},
): TimelineEventRecord {
  return {
    id: EventId(id),
    taskId: TaskId("t"),
    kind,
    lane: "user",
    title: id,
    metadata,
    classification: EMPTY_CLASSIFICATION,
    createdAt: new Date(ms).toISOString(),
  };
}

describe("buildFeed", () => {
  it("returns an empty array when there are no events", () => {
    expect(buildFeed([], 0)).toEqual([]);
  });

  it("prepends a 'Task started' time-mark when at least one event exists", () => {
    const baseMs = new Date(2026, 4, 8, 14, 3, 12).getTime();
    const items = buildFeed([event("a", "action.logged", baseMs + 1000)], baseMs);
    expect(items[0]).toMatchObject({
      kind: "time-mark",
      label: "Task started · 14:03:12",
      tone: "normal",
    });
    expect(items[1]).toMatchObject({ kind: "act" });
  });

  it("converts context.saved events into compact time-marks", () => {
    // `context.saved` is overloaded — only the compact hooks set
    // metadata.compactPhase, which is the truth marker for compaction.
    const base = 1_000_000_000;
    const items = buildFeed(
      [
        event("a", "action.logged", base + 1000),
        event("b", "context.saved", base + 2000, { compactPhase: "before" }),
        event("c", "action.logged", base + 3000),
      ],
      base,
    );
    const tones = items
      .filter((it): it is Extract<typeof it, { kind: "time-mark" }> => it.kind === "time-mark")
      .map((it) => it.tone);
    expect(tones).toEqual(["normal", "compact"]);
    // The compact mark replaces the act — feed has 1 head + 2 acts + 1 compact = 4
    expect(items).toHaveLength(4);
  });

  it("sorts events ascending by createdAt", () => {
    const base = 1_000_000_000;
    const items = buildFeed(
      [
        event("c", "action.logged", base + 3000),
        event("a", "action.logged", base + 1000),
        event("b", "action.logged", base + 2000),
      ],
      base,
    );
    const acts = items.filter((it): it is Extract<typeof it, { kind: "act" }> => it.kind === "act");
    expect(acts.map((a) => a.vm.event.id)).toEqual(["a", "b", "c"]);
  });
});
