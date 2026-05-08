import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  EventClassificationMatch,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, TaskId } from "~domain/monitoring.js";
import { countRuleMatches, ruleMatchCount } from "./rule-matches.js";

function match(ruleId: string): EventClassificationMatch {
  return {
    ruleId,
    score: 1,
    tags: [],
    reasons: [],
  };
}

function event(matches: EventClassificationMatch[]): TimelineEventRecord {
  const classification: EventClassification = {
    lane: "user",
    tags: [],
    matches,
  };
  return {
    id: EventId("e"),
    taskId: TaskId("t"),
    kind: "action.logged",
    lane: "user",
    title: "x",
    metadata: {},
    classification,
    createdAt: new Date(0).toISOString(),
  };
}

describe("countRuleMatches", () => {
  it("returns an empty map when no events have matches", () => {
    expect(countRuleMatches([event([])])).toEqual({});
  });

  it("aggregates matches across events", () => {
    const result = countRuleMatches([
      event([match("a"), match("b")]),
      event([match("a")]),
      event([match("c"), match("a")]),
    ]);
    expect(result).toEqual({ a: 3, b: 1, c: 1 });
  });

  it("counts the same rule twice when an event matches it twice", () => {
    expect(countRuleMatches([event([match("a"), match("a")])])).toEqual({
      a: 2,
    });
  });
});

describe("ruleMatchCount", () => {
  it("returns 0 when the rule isn't in the map", () => {
    expect(ruleMatchCount({}, "missing")).toBe(0);
  });
  it("returns the count when present", () => {
    expect(ruleMatchCount({ a: 5 }, "a")).toBe(5);
  });
});
