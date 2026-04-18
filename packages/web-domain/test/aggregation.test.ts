import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "@monitor/domain";
import type { TimelineEvent } from "../src/types.js";
import {
    buildExplorationInsight,
    collectExploredFiles,
    collectWebLookups,
    countUniqueExploredFiles,
    getTokenSummary
} from "../src/lib/insights/aggregation.js";

type EventOverrides = Omit<Partial<TimelineEvent>, "id" | "taskId"> & {
    id?: string;
    taskId?: string;
};

function makeEvent(overrides: EventOverrides = {}): TimelineEvent {
    const { id, taskId, ...rest } = overrides;
    return {
        id: EventId(id ?? "event-1"),
        taskId: TaskId(taskId ?? "task-1"),
        kind: rest.kind ?? "tool.used",
        lane: rest.lane ?? "implementation",
        title: rest.title ?? "event",
        metadata: rest.metadata ?? {},
        classification: rest.classification ?? {
            lane: rest.lane ?? "implementation",
            tags: [],
            matches: []
        },
        createdAt: rest.createdAt ?? "2026-03-16T12:00:00.000Z",
        ...rest
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 — Exploration tool breakdown excludes instructions.loaded
// ─────────────────────────────────────────────────────────────────────────────

describe("buildExplorationInsight — instructions.loaded filtering", () => {
    it("does NOT count instructions.loaded events in the tool breakdown", () => {
        const timeline = [
            makeEvent({
                id: "read-1",
                kind: "tool.used",
                lane: "exploration",
                title: "Read src/app.ts",
                metadata: { toolName: "Read", filePaths: ["src/app.ts"] }
            }),
            makeEvent({
                id: "instr-1",
                kind: "instructions.loaded",
                lane: "exploration",
                title: "System reminder loaded",
                metadata: { loadReason: "compact" }
            }),
            makeEvent({
                id: "instr-2",
                kind: "instructions.loaded",
                lane: "exploration",
                title: "Skill listing",
                metadata: { loadReason: "skill" }
            })
        ];
        const insight = buildExplorationInsight(timeline, [], []);
        expect(insight.totalExplorations).toBe(1);
        // The breakdown must NOT have an "instructions.loaded" or skill-like bucket.
        expect(Object.keys(insight.toolBreakdown)).not.toContain("instructions.loaded");
        // Should only see real exploration tool(s).
        expect(insight.toolBreakdown).toEqual(
            expect.objectContaining({})
        );
        const breakdownValues = Object.values(insight.toolBreakdown);
        expect(breakdownValues.reduce((a, b) => a + b, 0)).toBe(1);
    });

    it("does NOT count user.message events in the tool breakdown when lane=exploration", () => {
        // Pathological: user.message routed to exploration lane (e.g. via classifier).
        const timeline = [
            makeEvent({
                id: "grep-1",
                kind: "tool.used",
                lane: "exploration",
                title: "Grep exports",
                metadata: { toolName: "Grep" }
            }),
            makeEvent({
                id: "user-1",
                kind: "user.message",
                lane: "exploration",
                title: "please read README.md",
                metadata: { filePaths: ["README.md"] }
            })
        ];
        const insight = buildExplorationInsight(timeline, [], []);
        expect(insight.totalExplorations).toBe(1);
    });

    it("still counts real tool.used / file.changed skipping for breakdown", () => {
        const timeline = [
            makeEvent({
                id: "grep-1",
                kind: "tool.used",
                lane: "exploration",
                title: "Grep",
                metadata: { toolName: "Grep" }
            }),
            makeEvent({
                id: "glob-1",
                kind: "tool.used",
                lane: "exploration",
                title: "Glob",
                metadata: { toolName: "Glob" }
            }),
            makeEvent({
                id: "file-change-1",
                kind: "file.changed",
                lane: "exploration",
                title: "src/foo.ts",
                metadata: { filePaths: ["src/foo.ts"] }
            })
        ];
        const insight = buildExplorationInsight(timeline, [], []);
        // file.changed is excluded from the breakdown (but contributes to uniqueFiles).
        expect(insight.totalExplorations).toBe(2);
        expect(Object.keys(insight.toolBreakdown).length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D2 — File-count selector is canonical and dedupes correctly
// ─────────────────────────────────────────────────────────────────────────────

describe("collectExploredFiles + countUniqueExploredFiles — canonical source", () => {
    it("ignores filePaths attached to instructions.loaded events", () => {
        const timeline = [
            makeEvent({
                id: "real-read",
                kind: "tool.used",
                lane: "exploration",
                title: "Read a.ts",
                metadata: { filePaths: ["a.ts"] }
            }),
            makeEvent({
                id: "instr-with-paths",
                kind: "instructions.loaded",
                lane: "exploration",
                title: "Loaded skill attachments",
                metadata: { filePaths: ["skill-b.md", "skill-c.md"] }
            })
        ];
        const files = collectExploredFiles(timeline);
        expect(files.map((f) => f.path)).toEqual(["a.ts"]);
        expect(countUniqueExploredFiles(timeline)).toBe(1);
    });

    it("ignores filePaths attached to user.message events even if lane is exploration", () => {
        const timeline = [
            makeEvent({
                id: "tool-read",
                kind: "tool.used",
                lane: "exploration",
                title: "Read src/app.ts",
                metadata: { filePaths: ["src/app.ts"] }
            }),
            // Polluted user.message with regex-extracted filePaths, routed to exploration.
            makeEvent({
                id: "user-mention",
                kind: "user.message",
                lane: "exploration",
                title: "please review readme",
                metadata: { filePaths: ["README.md", "docs/a.md", "docs/b.md"] }
            })
        ];
        expect(countUniqueExploredFiles(timeline)).toBe(1);
    });

    it("dedupes repeated file references across multiple tool.used events", () => {
        const timeline = [
            makeEvent({
                id: "r1",
                kind: "tool.used",
                lane: "exploration",
                title: "Read",
                metadata: { filePaths: ["src/a.ts"] },
                createdAt: "2026-03-16T12:00:00.000Z"
            }),
            makeEvent({
                id: "r2",
                kind: "tool.used",
                lane: "exploration",
                title: "Read again",
                metadata: { filePaths: ["src/a.ts"] },
                createdAt: "2026-03-16T12:05:00.000Z"
            }),
            makeEvent({
                id: "r3",
                kind: "tool.used",
                lane: "exploration",
                title: "Read other",
                metadata: { filePaths: ["src/b.ts"] },
                createdAt: "2026-03-16T12:10:00.000Z"
            })
        ];
        const files = collectExploredFiles(timeline);
        expect(files.map((f) => f.path).sort()).toEqual(["src/a.ts", "src/b.ts"]);
        expect(countUniqueExploredFiles(timeline)).toBe(2);
    });

    it("returns 0 for an empty timeline", () => {
        expect(countUniqueExploredFiles([])).toBe(0);
    });

    it("ExplorationInsight.uniqueFiles stays in sync with countUniqueExploredFiles", () => {
        const timeline = [
            makeEvent({
                id: "read-a",
                kind: "tool.used",
                lane: "exploration",
                title: "Read a",
                metadata: { filePaths: ["a.ts"] }
            }),
            makeEvent({
                id: "read-b",
                kind: "tool.used",
                lane: "exploration",
                title: "Read b",
                metadata: { filePaths: ["b.ts"] }
            }),
            // Pollution — must not contribute to file count.
            makeEvent({
                id: "user-mention",
                kind: "user.message",
                lane: "exploration",
                title: "a mention",
                metadata: { filePaths: ["fake-1.ts", "fake-2.ts"] }
            }),
            makeEvent({
                id: "instr-mention",
                kind: "instructions.loaded",
                lane: "exploration",
                title: "attachment",
                metadata: { filePaths: ["deferred.md"] }
            })
        ];
        const exploredFiles = collectExploredFiles(timeline);
        const insight = buildExplorationInsight(timeline, exploredFiles, []);
        expect(insight.uniqueFiles).toBe(countUniqueExploredFiles(timeline));
        expect(insight.uniqueFiles).toBe(2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// D3 — Token aggregation correctness with edge cases
// ─────────────────────────────────────────────────────────────────────────────

function makeAssistantResponse(overrides: EventOverrides = {}): TimelineEvent {
    return makeEvent({
        kind: "assistant.response",
        lane: "user",
        title: "Assistant turn",
        ...overrides
    });
}

describe("getTokenSummary", () => {
    it("returns zeros and 0% hit rate for empty timeline", () => {
        const summary = getTokenSummary([]);
        expect(summary).toEqual({
            totalNewInput: 0,
            totalCacheRead: 0,
            totalCacheCreate: 0,
            totalOutput: 0,
            overallHitRate: 0,
            turnCount: 0
        });
    });

    it("returns zeros when no assistant.response events exist", () => {
        const timeline = [
            makeEvent({ kind: "tool.used", lane: "implementation" }),
            makeEvent({ kind: "user.message", lane: "user" })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.turnCount).toBe(0);
        expect(summary.overallHitRate).toBe(0);
    });

    it("aggregates tokens across multiple assistant.response events", () => {
        const timeline = [
            makeAssistantResponse({
                id: "turn-1",
                metadata: {
                    inputTokens: 100,
                    outputTokens: 50,
                    cacheReadTokens: 0,
                    cacheCreateTokens: 400
                }
            }),
            makeAssistantResponse({
                id: "turn-2",
                metadata: {
                    inputTokens: 10,
                    outputTokens: 20,
                    cacheReadTokens: 400,
                    cacheCreateTokens: 0
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(110);
        expect(summary.totalOutput).toBe(70);
        expect(summary.totalCacheRead).toBe(400);
        expect(summary.totalCacheCreate).toBe(400);
        expect(summary.turnCount).toBe(2);
        // Hit rate = 400 / (110 + 400 + 400) = 400/910 ≈ 43.96%
        expect(summary.overallHitRate).toBeCloseTo((400 / 910) * 100, 5);
    });

    it("edge case — zero input (only output)", () => {
        const timeline = [
            makeAssistantResponse({
                id: "out-only",
                metadata: { outputTokens: 50 }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(0);
        expect(summary.totalCacheRead).toBe(0);
        expect(summary.totalCacheCreate).toBe(0);
        expect(summary.totalOutput).toBe(50);
        expect(summary.overallHitRate).toBe(0);
        expect(summary.turnCount).toBe(1);
    });

    it("edge case — only cache-read tokens gives 100% hit rate", () => {
        const timeline = [
            makeAssistantResponse({
                id: "cache-only",
                metadata: {
                    inputTokens: 0,
                    cacheReadTokens: 500,
                    cacheCreateTokens: 0,
                    outputTokens: 25
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalCacheRead).toBe(500);
        expect(summary.overallHitRate).toBe(100);
    });

    it("edge case — only cache-create (no reads) gives 0% hit rate", () => {
        const timeline = [
            makeAssistantResponse({
                id: "create-only",
                metadata: {
                    inputTokens: 0,
                    cacheReadTokens: 0,
                    cacheCreateTokens: 1000,
                    outputTokens: 10
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalCacheCreate).toBe(1000);
        expect(summary.overallHitRate).toBe(0);
    });

    it("edge case — only new input tokens gives 0% hit rate", () => {
        const timeline = [
            makeAssistantResponse({
                id: "new-only",
                metadata: {
                    inputTokens: 200,
                    outputTokens: 30
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(200);
        expect(summary.overallHitRate).toBe(0);
    });

    it("ignores missing / non-numeric token metadata (treats as 0)", () => {
        const timeline = [
            makeAssistantResponse({
                id: "missing",
                metadata: {}
            }),
            makeAssistantResponse({
                id: "bad-types",
                metadata: {
                    inputTokens: "not-a-number",
                    outputTokens: null,
                    cacheReadTokens: undefined
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(0);
        expect(summary.totalCacheRead).toBe(0);
        expect(summary.totalCacheCreate).toBe(0);
        expect(summary.totalOutput).toBe(0);
        expect(summary.overallHitRate).toBe(0);
        expect(summary.turnCount).toBe(2);
    });

    it("ignores non-assistant events when aggregating tokens", () => {
        const timeline = [
            makeEvent({
                kind: "tool.used",
                lane: "implementation",
                metadata: {
                    inputTokens: 9999,
                    cacheReadTokens: 9999,
                    cacheCreateTokens: 9999,
                    outputTokens: 9999
                }
            }),
            makeAssistantResponse({
                id: "real",
                metadata: {
                    inputTokens: 5,
                    cacheReadTokens: 10,
                    cacheCreateTokens: 0,
                    outputTokens: 2
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(5);
        expect(summary.totalCacheRead).toBe(10);
        expect(summary.totalCacheCreate).toBe(0);
        expect(summary.totalOutput).toBe(2);
        expect(summary.turnCount).toBe(1);
        expect(summary.overallHitRate).toBeCloseTo((10 / 15) * 100, 5);
    });

    it("clamps negative token counts to zero", () => {
        const timeline = [
            makeAssistantResponse({
                id: "neg",
                metadata: {
                    inputTokens: -50,
                    cacheReadTokens: -10,
                    cacheCreateTokens: 100,
                    outputTokens: -5
                }
            })
        ];
        const summary = getTokenSummary(timeline);
        expect(summary.totalNewInput).toBe(0);
        expect(summary.totalCacheRead).toBe(0);
        expect(summary.totalCacheCreate).toBe(100);
        expect(summary.totalOutput).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Supporting — sanity: existing collectors still work
// ─────────────────────────────────────────────────────────────────────────────

describe("collectWebLookups — unchanged behavior", () => {
    it("still collects exploration-lane WebSearch events", () => {
        const timeline = [
            makeEvent({
                id: "ws-1",
                kind: "tool.used",
                lane: "exploration",
                title: "WebSearch",
                metadata: { toolName: "WebSearch", webUrls: ["typescript generics"] }
            })
        ];
        const lookups = collectWebLookups(timeline);
        expect(lookups).toHaveLength(1);
        expect(lookups[0]?.url).toBe("typescript generics");
    });
});
