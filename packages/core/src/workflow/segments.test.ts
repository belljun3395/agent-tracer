import { describe, expect, it } from "vitest";
import { segmentEventsByTurn } from "./segments.js";
import type { TimelineEvent } from "@monitor/domain";
import { EventId, TaskId } from "@monitor/domain";
import type { EventClassification } from "@monitor/domain";

const classification: EventClassification = { lane: "exploration", tags: [], matches: [] };

function makeEvent(kind: TimelineEvent["kind"], createdAt: string, options: Partial<TimelineEvent> = {}): TimelineEvent {
    return {
        id: EventId(`evt-${kind}-${createdAt}`),
        taskId: TaskId("task-1"),
        kind,
        lane: options.lane ?? "exploration",
        title: options.title ?? `${kind} @ ${createdAt}`,
        metadata: options.metadata ?? {},
        classification,
        createdAt,
        ...(options.body !== undefined ? { body: options.body } : {}),
    };
}

describe("segmentEventsByTurn", () => {
    it("returns a single prelude turn when no user.message exists", () => {
        const events = [
            makeEvent("task.start", "2026-04-17T10:00:00Z"),
            makeEvent("tool.used", "2026-04-17T10:00:01Z"),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments).toHaveLength(1);
        expect(segments[0]?.turnIndex).toBe(1);
        expect(segments[0]?.isPrelude).toBe(true);
        expect(segments[0]?.events).toHaveLength(2);
        expect(segments[0]?.requestPreview).toBeNull();
    });

    it("assigns pre-prompt events to a prelude segment and each user.message starts a new turn", () => {
        const events = [
            makeEvent("task.start", "2026-04-17T10:00:00Z"),
            makeEvent("user.message", "2026-04-17T10:00:05Z", { body: "Fix the bug in auth.ts" }),
            makeEvent("tool.used", "2026-04-17T10:00:06Z"),
            makeEvent("assistant.response", "2026-04-17T10:00:10Z"),
            makeEvent("user.message", "2026-04-17T10:00:20Z", { body: "Now add tests" }),
            makeEvent("tool.used", "2026-04-17T10:00:21Z"),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments.map((segment) => segment.turnIndex)).toEqual([0, 1, 2]);
        expect(segments[0]?.isPrelude).toBe(true);
        expect(segments[0]?.events).toHaveLength(1);
        expect(segments[1]?.events).toHaveLength(3);
        expect(segments[1]?.requestPreview).toBe("Fix the bug in auth.ts");
        expect(segments[2]?.events).toHaveLength(2);
        expect(segments[2]?.requestPreview).toBe("Now add tests");
    });

    it("handles repeated user.messages without intervening events", () => {
        const events = [
            makeEvent("user.message", "2026-04-17T10:00:00Z", { body: "A" }),
            makeEvent("user.message", "2026-04-17T10:00:01Z", { body: "B" }),
            makeEvent("assistant.response", "2026-04-17T10:00:02Z"),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments).toHaveLength(2);
        expect(segments[0]?.events).toHaveLength(1);
        expect(segments[1]?.events).toHaveLength(2);
        expect(segments[0]?.requestPreview).toBe("A");
        expect(segments[1]?.requestPreview).toBe("B");
    });

    it("sets startAt and endAt on each segment", () => {
        const events = [
            makeEvent("user.message", "2026-04-17T10:00:00Z"),
            makeEvent("tool.used", "2026-04-17T10:00:05Z"),
            makeEvent("user.message", "2026-04-17T10:01:00Z"),
            makeEvent("tool.used", "2026-04-17T10:01:10Z"),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments[0]?.startAt).toBe("2026-04-17T10:00:00Z");
        expect(segments[0]?.endAt).toBe("2026-04-17T10:01:00Z");
        expect(segments[1]?.startAt).toBe("2026-04-17T10:01:00Z");
        expect(segments[1]?.endAt).toBe("2026-04-17T10:01:10Z");
    });

    it("returns an empty array when events is empty", () => {
        expect(segmentEventsByTurn([])).toEqual([]);
    });

    it("truncates long request previews", () => {
        const longBody = "x".repeat(500);
        const events = [makeEvent("user.message", "2026-04-17T10:00:00Z", { body: longBody })];
        const segments = segmentEventsByTurn(events);
        const preview = segments[0]?.requestPreview ?? "";
        expect(preview.length).toBeLessThanOrEqual(120);
        expect(preview.endsWith("…")).toBe(true);
    });

    it("uses title when body is missing on user.message", () => {
        const events = [
            makeEvent("user.message", "2026-04-17T10:00:00Z", { title: "Run the tests" }),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments[0]?.requestPreview).toBe("Run the tests");
    });
});

describe("segmentEventsByTurn — stable ordering", () => {
    it("preserves input ordering within a segment even if timestamps are unsorted", () => {
        const events = [
            makeEvent("user.message", "2026-04-17T10:00:00Z", { body: "first" }),
            makeEvent("tool.used", "2026-04-17T10:00:03Z", { title: "third-in-input" }),
            makeEvent("tool.used", "2026-04-17T10:00:02Z", { title: "second-in-input" }),
        ];
        const segments = segmentEventsByTurn(events);
        expect(segments[0]?.events.map((event) => event.title)).toEqual([
            "user.message @ 2026-04-17T10:00:00Z",
            "third-in-input",
            "second-in-input",
        ]);
    });
});
