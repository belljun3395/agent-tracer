import { describe, expect, it, vi } from "vitest";
import {
    countNonPreludeTurns,
    createDefaultTurnPartition,
    createTurnPartitionUpdate,
    resolveTurnPartition,
    validatePartition,
} from "./turn.partition.js";
import type { TimelineEvent } from "~activity/event/public/types/event.types.js";
import type { TurnPartition } from "./turn.partition.model.js";

function userMessage(id: string, createdAt: string): TimelineEvent {
    return {
        id,
        taskId: "t-1",
        kind: "user.message",
        lane: "user",
        title: "u",
        metadata: {},
        classification: { lane: "user", tags: [], matches: [] },
        createdAt,
    } as unknown as TimelineEvent;
}

function fixedFactory(prefix = "tg"): () => string {
    let i = 0;
    return () => {
        i += 1;
        return `${prefix}-${i}`;
    };
}

describe("createDefaultTurnPartition", () => {
    it("uses the injected id factory for each group (no globalThis.crypto)", () => {
        const factory = vi.fn(fixedFactory());
        const events = [
            userMessage("u-1", "2026-04-29T10:00:00.000Z"),
            userMessage("u-2", "2026-04-29T10:05:00.000Z"),
        ];

        const partition = createDefaultTurnPartition("t-1", events, "2026-04-29T10:10:00.000Z", factory);

        expect(factory).toHaveBeenCalledTimes(2);
        expect(partition.groups.map((g) => g.id)).toEqual(["tg-1", "tg-2"]);
        expect(partition.groups[0]!.from).toBe(1);
        expect(partition.groups[1]!.from).toBe(2);
        expect(partition.taskId).toBe("t-1");
        expect(partition.version).toBe(1);
        expect(partition.updatedAt).toBe("2026-04-29T10:10:00.000Z");
    });

    it("returns an empty partition when there are no events (id factory not called)", () => {
        const factory = vi.fn(fixedFactory());

        const partition = createDefaultTurnPartition("t-1", [], "2026-04-29T10:10:00.000Z", factory);

        expect(factory).not.toHaveBeenCalled();
        expect(partition.groups).toEqual([]);
    });
});

describe("countNonPreludeTurns", () => {
    it("returns the number of user.message-bounded segments", () => {
        const events = [
            userMessage("u-1", "2026-04-29T10:00:00.000Z"),
            userMessage("u-2", "2026-04-29T10:05:00.000Z"),
            userMessage("u-3", "2026-04-29T10:10:00.000Z"),
        ];

        expect(countNonPreludeTurns(events)).toBe(3);
    });

    it("returns 0 for an empty event list", () => {
        expect(countNonPreludeTurns([])).toBe(0);
    });
});

describe("validatePartition", () => {
    it("accepts a contiguous partition matching totalTurns", () => {
        const partition: TurnPartition = {
            taskId: "t-1",
            groups: [
                { id: "tg-1", from: 1, to: 1, label: null, visible: true },
                { id: "tg-2", from: 2, to: 3, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-29T10:00:00.000Z",
        };

        expect(() => validatePartition(partition, 3)).not.toThrow();
    });

    it("rejects partitions that don't start at turn 1", () => {
        const partition: TurnPartition = {
            taskId: "t-1",
            groups: [{ id: "tg-1", from: 2, to: 2, label: null, visible: true }],
            version: 1,
            updatedAt: "2026-04-29T10:00:00.000Z",
        };

        expect(() => validatePartition(partition, 1)).toThrow(/start at turn 1/);
    });

    it("rejects gaps between groups", () => {
        const partition: TurnPartition = {
            taskId: "t-1",
            groups: [
                { id: "tg-1", from: 1, to: 1, label: null, visible: true },
                { id: "tg-2", from: 3, to: 3, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-29T10:00:00.000Z",
        };

        expect(() => validatePartition(partition, 3)).toThrow(/gap/);
    });

    it("rejects duplicate group ids", () => {
        const partition: TurnPartition = {
            taskId: "t-1",
            groups: [
                { id: "tg-dup", from: 1, to: 1, label: null, visible: true },
                { id: "tg-dup", from: 2, to: 2, label: null, visible: true },
            ],
            version: 1,
            updatedAt: "2026-04-29T10:00:00.000Z",
        };

        expect(() => validatePartition(partition, 2)).toThrow(/Duplicate/);
    });
});

describe("resolveTurnPartition", () => {
    it("returns a stored partition unchanged when it validates against current totals", () => {
        const events = [userMessage("u-1", "2026-04-29T10:00:00.000Z")];
        const stored: TurnPartition = {
            taskId: "t-1",
            groups: [{ id: "tg-keep", from: 1, to: 1, label: "kept", visible: true }],
            version: 7,
            updatedAt: "2026-04-29T09:00:00.000Z",
        };

        const result = resolveTurnPartition(
            { taskId: "t-1", stored, events, fallbackUpdatedAt: "2026-04-29T10:30:00.000Z" },
            fixedFactory(),
        );

        expect(result).toBe(stored);
        expect(result.version).toBe(7);
    });

    it("falls back to default but preserves stored.version when stored fails validation", () => {
        const events = [
            userMessage("u-1", "2026-04-29T10:00:00.000Z"),
            userMessage("u-2", "2026-04-29T10:05:00.000Z"),
        ];
        const stored: TurnPartition = {
            taskId: "t-1",
            // wrong: only covers 1 turn but events have 2
            groups: [{ id: "tg-stale", from: 1, to: 1, label: null, visible: true }],
            version: 5,
            updatedAt: "2026-04-29T09:00:00.000Z",
        };

        const result = resolveTurnPartition(
            { taskId: "t-1", stored, events, fallbackUpdatedAt: "2026-04-29T10:30:00.000Z" },
            fixedFactory(),
        );

        expect(result.version).toBe(5);
        expect(result.groups).toHaveLength(2);
        expect(result.groups.map((g) => g.id)).toEqual(["tg-1", "tg-2"]);
        expect(result.updatedAt).toBe("2026-04-29T10:30:00.000Z");
    });

    it("creates a fresh default with version=1 when nothing is stored", () => {
        const events = [userMessage("u-1", "2026-04-29T10:00:00.000Z")];

        const result = resolveTurnPartition(
            { taskId: "t-1", stored: null, events, fallbackUpdatedAt: "2026-04-29T10:30:00.000Z" },
            fixedFactory(),
        );

        expect(result.version).toBe(1);
    });
});

describe("createTurnPartitionUpdate", () => {
    it("increments version (existing.version + 1) and forwards updatedAt", () => {
        const existing: TurnPartition = {
            taskId: "t-1",
            groups: [],
            version: 4,
            updatedAt: "2026-04-29T09:00:00.000Z",
        };

        const out = createTurnPartitionUpdate({
            taskId: "t-1",
            groups: [{ id: "tg-1", from: 1, to: 1, label: "  spaced  ", visible: true }],
            existing,
            updatedAt: "2026-04-29T10:00:00.000Z",
        });

        expect(out.version).toBe(5);
        expect(out.updatedAt).toBe("2026-04-29T10:00:00.000Z");
        expect(out.groups[0]!.label).toBe("spaced");
    });

    it("starts version at 1 when no existing partition is provided", () => {
        const out = createTurnPartitionUpdate({
            taskId: "t-1",
            groups: [{ id: "tg-1", from: 1, to: 1, label: null, visible: true }],
            existing: null,
            updatedAt: "2026-04-29T10:00:00.000Z",
        });

        expect(out.version).toBe(1);
    });

    it("collapses empty/whitespace labels to null", () => {
        const out = createTurnPartitionUpdate({
            taskId: "t-1",
            groups: [
                { id: "tg-1", from: 1, to: 1, label: "   ", visible: true },
                { id: "tg-2", from: 2, to: 2, label: null, visible: true },
            ],
            existing: null,
            updatedAt: "2026-04-29T10:00:00.000Z",
        });

        expect(out.groups[0]!.label).toBeNull();
        expect(out.groups[1]!.label).toBeNull();
    });
});
