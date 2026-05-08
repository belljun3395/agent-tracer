import { describe, expect, it } from "vitest";
import type { OpenInferenceSpanRecord } from "~domain/openinference.js";
import { buildSpanTree } from "./build-span-tree.js";

function span(
  id: string,
  parent: string | undefined,
  startMs: number,
  kind: OpenInferenceSpanRecord["kind"] = "AGENT",
): OpenInferenceSpanRecord {
  return {
    spanId: id,
    name: id,
    kind,
    startTime: new Date(startMs).toISOString(),
    attributes: {},
    ...(parent ? { parentSpanId: parent } : {}),
  };
}

describe("buildSpanTree", () => {
  it("returns an empty list for empty input", () => {
    expect(buildSpanTree([])).toEqual([]);
  });

  it("emits a root span at depth 0 with no children", () => {
    const rows = buildSpanTree([span("a", undefined, 0)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.depth).toBe(0);
    expect(rows[0]?.hasChildren).toBe(false);
  });

  it("indents children one level deeper than their parent", () => {
    const rows = buildSpanTree([
      span("a", undefined, 0),
      span("b", "a", 100),
    ]);
    expect(rows.map((r) => [r.span.spanId, r.depth])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    expect(rows[0]?.hasChildren).toBe(true);
  });

  it("walks children chronologically (siblings sorted by startTime)", () => {
    const rows = buildSpanTree([
      span("a", undefined, 0),
      span("c", "a", 200),
      span("b", "a", 100),
    ]);
    expect(rows.map((r) => r.span.spanId)).toEqual(["a", "b", "c"]);
  });

  it("treats a span as a root when its parent is outside the provided set", () => {
    const rows = buildSpanTree([span("orphan", "missing-parent", 50)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.depth).toBe(0);
  });

  it("computes elapsedMsFromRoot relative to the earliest root start", () => {
    const rows = buildSpanTree([
      span("a", undefined, 1000),
      span("b", "a", 1500),
      span("c", undefined, 2000),
    ]);
    expect(rows.find((r) => r.span.spanId === "a")?.elapsedMsFromRoot).toBe(0);
    expect(rows.find((r) => r.span.spanId === "b")?.elapsedMsFromRoot).toBe(500);
    expect(rows.find((r) => r.span.spanId === "c")?.elapsedMsFromRoot).toBe(1000);
  });

  it("renders multiple root trees in start-time order", () => {
    const rows = buildSpanTree([
      span("r2", undefined, 200),
      span("r1", undefined, 100),
    ]);
    expect(rows.map((r) => r.span.spanId)).toEqual(["r1", "r2"]);
  });
});
