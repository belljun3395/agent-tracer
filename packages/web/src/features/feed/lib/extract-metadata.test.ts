import { describe, expect, it } from "vitest";
import type {
  EventClassification,
  TimelineEventRecord,
} from "~domain/monitoring.js";
import { EventId, TaskId } from "~domain/monitoring.js";
import {
  extractPaths,
  extractTokens,
  formatCompactCount,
} from "./extract-metadata.js";

const EMPTY_CLASSIFICATION: EventClassification = {
  lane: "user",
  tags: [],
  matches: [],
};

function event(
  overrides: Partial<TimelineEventRecord> = {},
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

describe("extractPaths", () => {
  it("returns [] when paths is undefined", () => {
    expect(extractPaths(event())).toEqual([]);
  });

  it("orders primaryPath first, then filePaths, then mentioned", () => {
    const result = extractPaths(
      event({
        paths: {
          primaryPath: "src/a.ts",
          filePaths: ["src/b.ts", "src/c.ts"],
          mentionedPaths: ["docs/intro.md"],
        },
      }),
    );
    expect(result).toEqual(["src/a.ts", "src/b.ts", "src/c.ts", "docs/intro.md"]);
  });

  it("dedupes paths that appear in multiple buckets", () => {
    const result = extractPaths(
      event({
        paths: {
          primaryPath: "src/a.ts",
          filePaths: ["src/a.ts", "src/b.ts"],
          mentionedPaths: ["src/b.ts"],
        },
      }),
    );
    expect(result).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("caps at 5 paths", () => {
    const filePaths = Array.from({ length: 12 }, (_, i) => `f${i}.ts`);
    const result = extractPaths(
      event({
        paths: { filePaths, mentionedPaths: [] },
      }),
    );
    expect(result).toHaveLength(5);
  });
});

describe("extractTokens", () => {
  it("returns null for events with no token fields", () => {
    expect(extractTokens(event())).toBeNull();
  });

  it("reads a flat tokens count", () => {
    expect(extractTokens(event({ metadata: { tokens: 1200 } }))).toEqual({
      total: 1200,
      input: null,
      output: null,
    });
  });

  it("reads input/output and computes total", () => {
    const result = extractTokens(
      event({ metadata: { input_tokens: 800, output_tokens: 400 } }),
    );
    expect(result).toEqual({ total: 1200, input: 800, output: 400 });
  });

  it("supports camelCase variants", () => {
    expect(
      extractTokens(
        event({ metadata: { inputTokens: 50, outputTokens: 30 } }),
      ),
    ).toEqual({ total: 80, input: 50, output: 30 });
  });

  it("reads from a nested usage object", () => {
    expect(
      extractTokens(
        event({
          metadata: {
            usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
          },
        }),
      ),
    ).toEqual({ total: 30, input: 10, output: 20 });
  });

  it("ignores negative or non-finite values", () => {
    expect(
      extractTokens(event({ metadata: { tokens: -1 } })),
    ).toBeNull();
    expect(
      extractTokens(event({ metadata: { tokens: Number.NaN } })),
    ).toBeNull();
  });
});

describe("formatCompactCount", () => {
  it.each<[number, string]>([
    [0, "0"],
    [42, "42"],
    [999, "999"],
    [1000, "1.0k"],
    [1234, "1.2k"],
    [9999, "10.0k"],
    [99500, "99.5k"],
    [100000, "100k"],
    [1500000, "1500k"],
  ])("formats %d as %s", (n, expected) => {
    expect(formatCompactCount(n)).toBe(expected);
  });
});
