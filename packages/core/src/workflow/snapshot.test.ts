import { describe, expect, it } from "vitest";
import { buildReusableTaskSnapshot } from "./snapshot.js";
import type { TimelineEvent } from "@monitor/domain";
import { EventId, TaskId } from "@monitor/domain";
import type { EventClassification } from "@monitor/domain";

const emptyClassification: EventClassification = { lane: "exploration", tags: [], matches: [] };

function makeExploreEvent(filePath: string, createdAt: string): TimelineEvent {
    return {
        id: EventId(`evt-${filePath}-${createdAt}`),
        taskId: TaskId("task-1"),
        kind: "tool.used",
        lane: "exploration",
        title: `Read: ${filePath}`,
        metadata: { filePaths: [filePath] },
        classification: emptyClassification,
        createdAt,
    };
}

describe("collectKeyFiles — read frequency ordering", () => {
    it("sorts keyFiles by read frequency descending", () => {
        const events: TimelineEvent[] = [
            makeExploreEvent("rarely.ts", "2024-01-01T00:00:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:01:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:02:00Z"),
            makeExploreEvent("hot.ts", "2024-01-01T00:03:00Z"),
            makeExploreEvent("warm.ts", "2024-01-01T00:04:00Z"),
            makeExploreEvent("warm.ts", "2024-01-01T00:05:00Z"),
        ];
        const snapshot = buildReusableTaskSnapshot({ objective: "test", events });
        const keyFiles = [...snapshot.keyFiles];
        expect(keyFiles.indexOf("hot.ts")).toBeLessThan(keyFiles.indexOf("warm.ts"));
        expect(keyFiles.indexOf("warm.ts")).toBeLessThan(keyFiles.indexOf("rarely.ts"));
    });
});
