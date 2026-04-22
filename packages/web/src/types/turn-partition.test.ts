import { describe, expect, it } from "vitest";
import type { TimelineEventRecord } from "./monitoring.js";
import {
    buildDefaultPartition,
    filterEventsByGroup,
    mergeAdjacentGroups,
    resolveTurnPartition,
    scopeKeyForGroup,
    splitGroup,
    validatePartition,
    type TurnGroup,
    type TurnPartition,
} from "./turn-partition.js";

const TASK_ID = "task-1";
const TS = "2026-04-22T10:00:00.000Z";

function makeEvent(id: string, kind: TimelineEventRecord["kind"], createdAt: string, body = ""): TimelineEventRecord {
    return {
        id: id as TimelineEventRecord["id"],
        taskId: TASK_ID as TimelineEventRecord["taskId"],
        kind,
        lane: "user",
        title: kind === "user.message" ? "prompt" : "tool",
        body,
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt,
    };
}

function threeTurnEvents(): readonly TimelineEventRecord[] {
    return [
        makeEvent("e0", "tool.used", "2026-04-22T10:00:00.000Z"),
        makeEvent("e1", "user.message", "2026-04-22T10:00:01.000Z", "first"),
        makeEvent("e2", "tool.used", "2026-04-22T10:00:02.000Z"),
        makeEvent("e3", "user.message", "2026-04-22T10:00:10.000Z", "second"),
        makeEvent("e4", "tool.used", "2026-04-22T10:00:11.000Z"),
        makeEvent("e5", "user.message", "2026-04-22T10:00:20.000Z", "third"),
        makeEvent("e6", "tool.used", "2026-04-22T10:00:21.000Z"),
    ];
}

describe("turn-partition (web mirror)", () => {
    it("builds a default single-turn partition", () => {
        const partition = buildDefaultPartition(TASK_ID, threeTurnEvents(), TS);
        expect(partition.groups).toHaveLength(3);
        expect(partition.groups.map((g: TurnGroup) => [g.from, g.to])).toEqual([[1, 1], [2, 2], [3, 3]]);
    });

    it("merges then splits back correctly", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), TS);
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, TS);
        expect(merged.groups[0]!.to).toBe(2);
        const split = splitGroup(merged, merged.groups[0]!.id, 2, TS);
        expect(split.groups.map((g: TurnGroup) => [g.from, g.to])).toEqual([[1, 1], [2, 2], [3, 3]]);
    });

    it("scopeKeyForGroup emits turn:N vs turns:N-M", () => {
        expect(scopeKeyForGroup({ id: "a", from: 2, to: 2, label: null, visible: true })).toBe("turn:2");
        expect(scopeKeyForGroup({ id: "a", from: 2, to: 4, label: null, visible: true })).toBe("turns:2-4");
    });

    it("filters events by group range", () => {
        const events = threeTurnEvents();
        const base = buildDefaultPartition(TASK_ID, events, TS);
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, TS);
        const subset = filterEventsByGroup(events, merged.groups[0]!);
        expect(subset.map((e: TimelineEventRecord) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    });

    it("rejects invalid partitions", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [
                { id: "a", from: 1, to: 1, label: null, visible: true },
                { id: "b", from: 3, to: 3, label: null, visible: true },
            ],
            version: 1,
            updatedAt: TS,
        };
        expect(() => validatePartition(partition, 3)).toThrow(/gap/i);
    });

    it("resolveTurnPartition falls back when stored shape is stale", () => {
        const events = threeTurnEvents();
        const stale: TurnPartition = {
            taskId: TASK_ID,
            groups: [{ id: "old", from: 1, to: 1, label: null, visible: true }],
            version: 3,
            updatedAt: TS,
        };
        const resolved = resolveTurnPartition({ taskId: TASK_ID, stored: stale, events, fallbackUpdatedAt: TS });
        expect(resolved.groups).toHaveLength(3);
        expect(resolved.version).toBe(1);
    });
});
