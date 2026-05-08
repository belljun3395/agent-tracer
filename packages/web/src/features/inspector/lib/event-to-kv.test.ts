import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, SessionId, TaskId } from "~domain/monitoring.js";
import { eventToKvPairs } from "./event-to-kv.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function event(
  overrides: Partial<TimelineEventRecord>,
): TimelineEventRecord {
  return {
    id: EventId("e"),
    taskId: TaskId("t"),
    kind: "action.logged",
    lane: "user",
    title: "x",
    metadata: {},
    classification: EMPTY_CLASSIFICATION,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("eventToKvPairs", () => {
  it("returns an empty list when no relevant fields are present", () => {
    expect(eventToKvPairs(event({}))).toEqual([]);
  });

  it("includes session id when present", () => {
    const result = eventToKvPairs(event({ sessionId: SessionId("sess-1") }));
    expect(result).toEqual([{ key: "session", value: "sess-1" }]);
  });

  it("emits runtime and hook from metadata strings", () => {
    const result = eventToKvPairs(
      event({ metadata: { runtime: "claude-plugin 0.4.2", hook: "PostToolUse · Edit" } }),
    );
    expect(result).toEqual([
      { key: "runtime", value: "claude-plugin 0.4.2" },
      { key: "hook", value: "PostToolUse · Edit" },
    ]);
  });

  it("prefers paths.primaryPath over filePaths[0]", () => {
    const result = eventToKvPairs(
      event({
        paths: {
          primaryPath: "src/a.ts",
          filePaths: ["src/b.ts"],
          mentionedPaths: [],
        },
      }),
    );
    expect(result).toEqual([{ key: "file", value: "src/a.ts" }]);
  });

  it("falls back to filePaths[0] when primaryPath is missing", () => {
    const result = eventToKvPairs(
      event({
        paths: {
          filePaths: ["src/x.ts", "src/y.ts"],
          mentionedPaths: [],
        },
      }),
    );
    expect(result).toEqual([{ key: "file", value: "src/x.ts" }]);
  });

  it("normalises trace_id and parent_event_id to canonical keys", () => {
    const result = eventToKvPairs(
      event({
        metadata: { traceId: "tr-1", parentEventId: "p-1" },
      }),
    );
    expect(result).toEqual([
      { key: "traceId", value: "tr-1" },
      { key: "parentEventId", value: "p-1" },
    ]);
  });

  it("ignores empty strings", () => {
    expect(
      eventToKvPairs(event({ metadata: { runtime: "", hook: "x" } })),
    ).toEqual([{ key: "hook", value: "x" }]);
  });
});
