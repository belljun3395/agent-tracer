import { describe, expect, it } from "vitest";
import { EventId, TaskId } from "@monitor/domain";
import {
    getInstructionsBurstFiles,
    groupInstructionsBursts,
    isInstructionsBurstEvent,
    type TimelineEvent
} from "@monitor/web-domain";

function makeInstruction(
    id: string,
    createdAt: string,
    metadata: Record<string, unknown> = {}
): TimelineEvent {
    const relPath = `.claude/rules/${id}.md`;
    return {
        id: EventId(id),
        taskId: TaskId("task-1"),
        kind: "instructions.loaded",
        lane: "planning",
        title: `Instructions loaded: ${id}`,
        body: relPath,
        metadata: {
            filePath: `/abs/${id}.md`,
            relPath,
            loadReason: "session_start",
            memoryType: "User",
            ...metadata
        },
        classification: { lane: "planning", tags: [], matches: [] },
        createdAt
    };
}

function makeTool(id: string, createdAt: string): TimelineEvent {
    return {
        id: EventId(id),
        taskId: TaskId("task-1"),
        kind: "tool.used",
        lane: "implementation",
        title: `Tool ${id}`,
        metadata: {},
        classification: { lane: "implementation", tags: [], matches: [] },
        createdAt
    };
}

describe("groupInstructionsBursts", () => {
    it("collapses 3+ instructions.loaded events within window into one batch", () => {
        const base = Date.parse("2026-04-17T10:00:00.000Z");
        const events = [
            makeInstruction("a", new Date(base).toISOString()),
            makeInstruction("b", new Date(base + 50).toISOString()),
            makeInstruction("c", new Date(base + 100).toISOString()),
            makeInstruction("d", new Date(base + 200).toISOString())
        ];
        const grouped = groupInstructionsBursts(events);
        expect(grouped).toHaveLength(1);
        const [batch] = grouped;
        expect(batch).toBeDefined();
        expect(isInstructionsBurstEvent(batch!)).toBe(true);
        expect(batch!.title).toContain("Instructions batch (4");
        const files = getInstructionsBurstFiles(batch!);
        expect(files.map((f) => f.relPath)).toEqual([
            ".claude/rules/a.md",
            ".claude/rules/b.md",
            ".claude/rules/c.md",
            ".claude/rules/d.md"
        ]);
    });

    it("preserves unrelated events between bursts", () => {
        const base = Date.parse("2026-04-17T10:00:00.000Z");
        const events = [
            makeInstruction("a", new Date(base).toISOString()),
            makeInstruction("b", new Date(base + 100).toISOString()),
            makeInstruction("c", new Date(base + 200).toISOString()),
            makeTool("tool-1", new Date(base + 5_000).toISOString()),
            makeInstruction("d", new Date(base + 10_000).toISOString()),
            makeInstruction("e", new Date(base + 10_100).toISOString()),
            makeInstruction("f", new Date(base + 10_200).toISOString())
        ];
        const grouped = groupInstructionsBursts(events);
        expect(grouped).toHaveLength(3);
        expect(grouped[0]).toBeDefined();
        expect(grouped[1]).toBeDefined();
        expect(grouped[2]).toBeDefined();
        expect(isInstructionsBurstEvent(grouped[0]!)).toBe(true);
        expect(grouped[1]!.kind).toBe("tool.used");
        expect(isInstructionsBurstEvent(grouped[2]!)).toBe(true);
    });

    it("keeps individual events when burst is below threshold", () => {
        const base = Date.parse("2026-04-17T10:00:00.000Z");
        const events = [
            makeInstruction("a", new Date(base).toISOString()),
            makeInstruction("b", new Date(base + 100).toISOString())
        ];
        const grouped = groupInstructionsBursts(events);
        expect(grouped).toHaveLength(2);
        expect(isInstructionsBurstEvent(grouped[0]!)).toBe(false);
    });

    it("does not group when gap exceeds window", () => {
        const base = Date.parse("2026-04-17T10:00:00.000Z");
        const events = [
            makeInstruction("a", new Date(base).toISOString()),
            makeInstruction("b", new Date(base + 100).toISOString()),
            makeInstruction("c", new Date(base + 5_000).toISOString())
        ];
        const grouped = groupInstructionsBursts(events);
        expect(grouped).toHaveLength(3);
        expect(grouped.every((e) => !isInstructionsBurstEvent(e))).toBe(true);
    });

    it("is idempotent: re-running does not re-collapse batch events", () => {
        const base = Date.parse("2026-04-17T10:00:00.000Z");
        const events = Array.from({ length: 5 }, (_, idx) =>
            makeInstruction(`id-${idx}`, new Date(base + idx * 80).toISOString())
        );
        const first = groupInstructionsBursts(events);
        const second = groupInstructionsBursts(first);
        expect(second).toHaveLength(1);
        expect(second[0]!.id).toBe(first[0]!.id);
    });
});
