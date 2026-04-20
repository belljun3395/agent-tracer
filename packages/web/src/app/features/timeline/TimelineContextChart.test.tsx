import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "../../../types.js";
import { TimelineContextChart } from "./TimelineContextChart.js";

describe("TimelineContextChart", () => {
    it("renders the model timeline even when context usage is unavailable", () => {
        const snapshotItem = {
            event: {
                id: EventId("event-1"),
                taskId: TaskId("task-1"),
                kind: "context.snapshot" as const,
                lane: "telemetry" as const,
                title: "Codex status snapshot",
                metadata: {
                    modelId: "gpt-5.4",
                    rateLimitPrimaryUsedPct: 14,
                },
                classification: { lane: "telemetry" as const, tags: [], matches: [] },
                createdAt: "2026-04-20T12:31:23.212Z",
            },
            laneKey: "telemetry",
            baseLane: "telemetry" as const,
            left: 200,
            top: 0,
            rowIndex: 0,
        };

        const markup = renderToStaticMarkup(
            <TimelineContextChart
                timelineWidth={1200}
                allItems={[snapshotItem]}
                snapshotItems={[snapshotItem]}
                compactItems={[]}
                contextWarningPrefs={{ enabled: true, thresholdPct: 80 }}
            />,
        );

        expect(markup).toContain("Model");
        expect(markup).toContain("Gpt");
    });
});
