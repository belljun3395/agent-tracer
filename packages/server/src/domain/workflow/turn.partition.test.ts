import { describe, expect, it } from "vitest";
import {
    buildDefaultPartition,
    filterEventsByGroup,
    findGroupByTurnIndex,
    mergeAdjacentGroups,
    resolveTurnPartition,
    scopeKeyForGroup,
    setGroupLabel,
    setGroupVisibility,
    splitGroup,
    validatePartition,
} from "./turn.partition.js";
import type { TurnGroup, TurnPartition } from "./turn.partition.js";
import type { TimelineEvent } from "../monitoring/timeline.event.js";

const TASK_ID = "task-1";

function makeEvent(id: string, kind: TimelineEvent["kind"], createdAt: string, body = ""): TimelineEvent {
    return {
        id,
        taskId: TASK_ID,
        kind,
        lane: "user",
        title: kind === "user.message" ? "user prompt" : "tool",
        body,
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt,
    };
}

function threeTurnEvents(): readonly TimelineEvent[] {
    return [
        makeEvent("e0", "tool.used", "2026-04-22T10:00:00.000Z"),
        makeEvent("e1", "user.message", "2026-04-22T10:00:01.000Z", "first prompt"),
        makeEvent("e2", "tool.used", "2026-04-22T10:00:02.000Z"),
        makeEvent("e3", "user.message", "2026-04-22T10:00:10.000Z", "second"),
        makeEvent("e4", "tool.used", "2026-04-22T10:00:11.000Z"),
        makeEvent("e5", "user.message", "2026-04-22T10:00:20.000Z", "third"),
        makeEvent("e6", "tool.used", "2026-04-22T10:00:21.000Z"),
    ];
}

describe("buildDefaultPartition", () => {
    it("creates one visible group per non-prelude turn", () => {
        const events = threeTurnEvents();
        const partition = buildDefaultPartition(TASK_ID, events, "2026-04-22T10:00:30.000Z");
        expect(partition.taskId).toBe(TASK_ID);
        expect(partition.groups).toHaveLength(3);
        expect(partition.groups.map((g: TurnGroup) => [g.from, g.to])).toEqual([[1, 1], [2, 2], [3, 3]]);
        expect(partition.groups.every((g: TurnGroup) => g.visible)).toBe(true);
        expect(partition.version).toBe(1);
    });

    it("returns empty groups when no turns exist", () => {
        const partition = buildDefaultPartition(TASK_ID, [], "2026-04-22T10:00:30.000Z");
        expect(partition.groups).toHaveLength(0);
    });
});

describe("validatePartition", () => {
    it("rejects gaps", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [
                { id: "g1", from: 1, to: 1, label: null, visible: true },
                { id: "g2", from: 3, to: 3, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 3)).toThrow(/gap/i);
    });

    it("rejects overlaps", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [
                { id: "g1", from: 1, to: 2, label: null, visible: true },
                { id: "g2", from: 2, to: 3, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 3)).toThrow(/overlap/i);
    });

    it("rejects inverted ranges", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [{ id: "g1", from: 3, to: 1, label: null, visible: true }],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 3)).toThrow(/range/i);
    });

    it("rejects duplicate ids", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [
                { id: "dup", from: 1, to: 1, label: null, visible: true },
                { id: "dup", from: 2, to: 2, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 2)).toThrow(/duplicate/i);
    });

    it("rejects mismatched total", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [{ id: "g1", from: 1, to: 2, label: null, visible: true }],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 3)).toThrow(/cover|total/i);
    });

    it("accepts empty partition with zero turns", () => {
        const partition: TurnPartition = {
            taskId: TASK_ID,
            groups: [],
            version: 1,
            updatedAt: "2026-04-22T10:00:30.000Z",
        };
        expect(() => validatePartition(partition, 0)).not.toThrow();
    });
});

describe("mergeAdjacentGroups", () => {
    it("merges the target group with the next one preserving the earlier id", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const firstId = base.groups[0]!.id;
        const merged = mergeAdjacentGroups(base, firstId, "2026-04-22T10:01:00.000Z");
        expect(merged.groups).toHaveLength(2);
        expect(merged.groups[0]).toMatchObject({ id: firstId, from: 1, to: 2 });
        expect(merged.groups[1]).toMatchObject({ from: 3, to: 3 });
        expect(merged.version).toBe(base.version + 1);
        expect(merged.updatedAt).toBe("2026-04-22T10:01:00.000Z");
    });

    it("throws when target group has no successor", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const lastId = base.groups[base.groups.length - 1]!.id;
        expect(() => mergeAdjacentGroups(base, lastId, "2026-04-22T10:01:00.000Z")).toThrow(/last/i);
    });

    it("throws for unknown group id", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        expect(() => mergeAdjacentGroups(base, "missing", "2026-04-22T10:01:00.000Z")).toThrow(/not found/i);
    });
});

describe("splitGroup", () => {
    it("splits a multi-turn group at the given turn index, keeping id on the left half", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, "2026-04-22T10:00:40.000Z");
        const wideId = merged.groups[0]!.id;
        const split = splitGroup(merged, wideId, 2, "2026-04-22T10:01:00.000Z");
        expect(split.groups).toHaveLength(3);
        expect(split.groups[0]).toMatchObject({ id: wideId, from: 1, to: 1 });
        expect(split.groups[1]).toMatchObject({ from: 2, to: 2 });
        expect(split.groups[2]).toMatchObject({ from: 3, to: 3 });
        expect(split.groups[1]!.id).not.toBe(wideId);
    });

    it("rejects splitting a single-turn group", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        expect(() => splitGroup(base, base.groups[0]!.id, 1, "2026-04-22T10:01:00.000Z")).toThrow(/single/i);
    });

    it("rejects splitting outside the group range", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, "2026-04-22T10:00:40.000Z");
        expect(() => splitGroup(merged, merged.groups[0]!.id, 3, "2026-04-22T10:01:00.000Z")).toThrow(/outside/i);
    });
});

describe("setGroupVisibility / setGroupLabel", () => {
    it("toggles visibility without mutating source", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const id = base.groups[0]!.id;
        const updated = setGroupVisibility(base, id, false, "2026-04-22T10:01:00.000Z");
        expect(updated.groups[0]!.visible).toBe(false);
        expect(base.groups[0]!.visible).toBe(true);
        expect(updated.version).toBe(base.version + 1);
    });

    it("sets and clears label", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const id = base.groups[0]!.id;
        const labelled = setGroupLabel(base, id, "Setup", "2026-04-22T10:01:00.000Z");
        expect(labelled.groups[0]!.label).toBe("Setup");
        const cleared = setGroupLabel(labelled, id, null, "2026-04-22T10:02:00.000Z");
        expect(cleared.groups[0]!.label).toBeNull();
    });
});

describe("filterEventsByGroup", () => {
    it("returns only events belonging to the group's turn range", () => {
        const events = threeTurnEvents();
        const base = buildDefaultPartition(TASK_ID, events, "2026-04-22T10:00:30.000Z");
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, "2026-04-22T10:00:40.000Z");
        const wide = merged.groups[0]!;
        const subset = filterEventsByGroup(events, wide);
        expect(subset.map((e: TimelineEvent) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    });
});

describe("scopeKeyForGroup", () => {
    it("renders single-turn groups as turn:N", () => {
        const scope = scopeKeyForGroup({ id: "g", from: 2, to: 2, label: null, visible: true });
        expect(scope).toBe("turn:2");
    });

    it("renders multi-turn groups as turns:N-M", () => {
        const scope = scopeKeyForGroup({ id: "g", from: 2, to: 5, label: null, visible: true });
        expect(scope).toBe("turns:2-5");
    });
});

describe("findGroupByTurnIndex", () => {
    it("locates the group containing the given turn", () => {
        const base = buildDefaultPartition(TASK_ID, threeTurnEvents(), "2026-04-22T10:00:30.000Z");
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, "2026-04-22T10:00:40.000Z");
        expect(findGroupByTurnIndex(merged, 2)?.from).toBe(1);
        expect(findGroupByTurnIndex(merged, 3)?.from).toBe(3);
        expect(findGroupByTurnIndex(merged, 99)).toBeNull();
    });
});

describe("resolveTurnPartition", () => {
    it("returns stored partition when it still matches the timeline turn count", () => {
        const events = threeTurnEvents();
        const base = buildDefaultPartition(TASK_ID, events, "2026-04-22T10:00:30.000Z");
        const merged = mergeAdjacentGroups(base, base.groups[0]!.id, "2026-04-22T10:00:40.000Z");
        const resolved = resolveTurnPartition({
            taskId: TASK_ID,
            stored: merged,
            events,
            fallbackUpdatedAt: "2026-04-22T10:02:00.000Z",
        });
        expect(resolved.groups).toEqual(merged.groups);
        expect(resolved.version).toBe(merged.version);
    });

    it("discards stored partition if turn count has grown and regenerates default", () => {
        const events = threeTurnEvents();
        const stored: TurnPartition = {
            taskId: TASK_ID,
            groups: [{ id: "only", from: 1, to: 1, label: null, visible: true }],
            version: 5,
            updatedAt: "2026-04-22T09:00:00.000Z",
        };
        const resolved = resolveTurnPartition({
            taskId: TASK_ID,
            stored,
            events,
            fallbackUpdatedAt: "2026-04-22T10:02:00.000Z",
        });
        expect(resolved.groups.map((g: TurnGroup) => [g.from, g.to])).toEqual([[1, 1], [2, 2], [3, 3]]);
        expect(resolved.version).toBe(1);
    });

    it("returns default when no partition is stored", () => {
        const events = threeTurnEvents();
        const resolved = resolveTurnPartition({
            taskId: TASK_ID,
            stored: null,
            events,
            fallbackUpdatedAt: "2026-04-22T10:02:00.000Z",
        });
        expect(resolved.groups).toHaveLength(3);
    });
});
