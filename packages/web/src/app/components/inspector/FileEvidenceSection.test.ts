import { describe, expect, it } from "vitest";
import { buildFileEvidenceRows, sortFileEvidenceRows } from "./FileEvidenceSection.js";

describe("buildFileEvidenceRows", () => {
    it("merges file activity and explored files by path", () => {
        const rows = buildFileEvidenceRows([
            {
                path: "/workspace/src/app.ts",
                readCount: 2,
                writeCount: 1,
                firstSeenAt: "2026-04-17T10:00:00.000Z",
                lastSeenAt: "2026-04-17T10:05:00.000Z",
                compactRelation: "after-compact"
            }
        ], [
            {
                path: "/workspace/src/app.ts",
                count: 4,
                firstSeenAt: "2026-04-17T09:55:00.000Z",
                lastSeenAt: "2026-04-17T10:06:00.000Z",
                readTimestamps: [],
                compactRelation: "after-compact",
                explorationSources: ["read_range · sed"]
            },
            {
                path: "/workspace/src/notes.md",
                count: 1,
                firstSeenAt: "2026-04-17T10:04:00.000Z",
                lastSeenAt: "2026-04-17T10:04:00.000Z",
                readTimestamps: [],
                compactRelation: "no-compact"
            }
        ]);

        expect(rows).toEqual([
            {
                path: "/workspace/src/app.ts",
                readCount: 2,
                writeCount: 1,
                explorationCount: 4,
                firstSeenAt: "2026-04-17T09:55:00.000Z",
                lastSeenAt: "2026-04-17T10:06:00.000Z",
                compactRelation: "after-compact",
                explorationSources: ["read_range · sed"]
            },
            {
                path: "/workspace/src/notes.md",
                readCount: 0,
                writeCount: 0,
                explorationCount: 1,
                firstSeenAt: "2026-04-17T10:04:00.000Z",
                lastSeenAt: "2026-04-17T10:04:00.000Z",
                compactRelation: "no-compact"
            }
        ]);
    });
});

describe("sortFileEvidenceRows", () => {
    const rows = [
        {
            path: "/workspace/z.ts",
            readCount: 1,
            writeCount: 0,
            explorationCount: 3,
            firstSeenAt: "2026-04-17T10:00:00.000Z",
            lastSeenAt: "2026-04-17T10:01:00.000Z",
            compactRelation: "after-compact" as const
        },
        {
            path: "/workspace/a.ts",
            readCount: 2,
            writeCount: 2,
            explorationCount: 1,
            firstSeenAt: "2026-04-17T10:00:00.000Z",
            lastSeenAt: "2026-04-17T10:02:00.000Z",
            compactRelation: "after-compact" as const
        }
    ];

    it("prioritizes writes for writes-first sorting", () => {
        expect(sortFileEvidenceRows(rows, "writes-first").map((row) => row.path)).toEqual([
            "/workspace/a.ts",
            "/workspace/z.ts"
        ]);
    });

    it("prioritizes exploration count for most-explored sorting", () => {
        expect(sortFileEvidenceRows(rows, "most-explored").map((row) => row.path)).toEqual([
            "/workspace/z.ts",
            "/workspace/a.ts"
        ]);
    });
});
