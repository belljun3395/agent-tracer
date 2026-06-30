import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRepetitionDetector } from "./command.repetition.detector.js";
import type { PreprocessingHintsRepository } from "@monitor/timeline-api/repository/preprocessing.hints.repository.js";
import type { TimelineEventEntity } from "@monitor/timeline-api/domain/timeline.event.entity.js";

function buildCommand(command: string, ageMs = 0, overallEffect: string | undefined = "read_only", target?: string): TimelineEventEntity {
    return {
        id: `cmd-${ageMs}`,
        taskId: "task-1",
        sessionId: null,
        kind: "terminal.command",
        lane: "implementation",
        title: command.slice(0, 60),
        body: command,
        subtypeKey: null,
        subtypeLabel: null,
        subtypeGroup: null,
        toolFamily: null,
        operation: null,
        sourceTool: null,
        toolName: null,
        entityType: null,
        entityName: null,
        displayTitle: null,
        evidenceLevel: null,
        extrasJson: JSON.stringify({
            command,
            commandAnalysis: {
                steps: target ? [{ targets: [{ type: "file", value: target }] }] : [],
                overallEffect,
            },
        }),
        createdAt: new Date(Date.now() - ageMs).toISOString(),
    } as TimelineEventEntity;
}

describe("CommandRepetitionDetector", () => {
    let repo: { findRecentTerminalCommands: ReturnType<typeof vi.fn> };
    let detector: CommandRepetitionDetector;

    beforeEach(() => {
        repo = { findRecentTerminalCommands: vi.fn() };
        detector = new CommandRepetitionDetector(repo as unknown as PreprocessingHintsRepository);
    });

    it("returns no hints for an empty command", async () => {
        repo.findRecentTerminalCommands.mockResolvedValue([]);
        const hints = await detector.detect("task-1", "");
        expect(hints).toEqual([]);
    });

    it("flags an exact command repeated 3+ times in the window", async () => {
        const cmd = "ls /tmp";
        repo.findRecentTerminalCommands.mockResolvedValue([
            buildCommand(cmd, 1000),
            buildCommand(cmd, 2000),
            buildCommand(cmd, 3000),
        ]);
        const hints = await detector.detect("task-1", cmd);
        expect(hints.some((h) => h.type === "command_repetition" && h.title.includes("Identical"))).toBe(true);
    });

    it("flags destructive command with warning severity", async () => {
        repo.findRecentTerminalCommands.mockResolvedValue([]);
        const hints = await detector.detect("task-1", "rm -rf node_modules");
        expect(hints.some((h) => h.type === "destructive_risk")).toBe(true);
    });

    it("escalates destructive_risk to critical during a destructive streak", async () => {
        repo.findRecentTerminalCommands.mockResolvedValue([
            buildCommand("git reset --hard HEAD~1", 60_000, "destructive"),
        ]);
        const hints = await detector.detect("task-1", "rm -rf build/");
        const destructive = hints.find((h) => h.type === "destructive_risk");
        expect(destructive?.severity).toBe("critical");
    });

    it("does not flag non-destructive commands", async () => {
        repo.findRecentTerminalCommands.mockResolvedValue([]);
        const hints = await detector.detect("task-1", "ls -la");
        expect(hints).toEqual([]);
    });

    it("ignores commands outside the 10-minute window", async () => {
        const cmd = "ls /tmp";
        repo.findRecentTerminalCommands.mockResolvedValue([
            buildCommand(cmd, 20 * 60 * 1000),
            buildCommand(cmd, 25 * 60 * 1000),
            buildCommand(cmd, 30 * 60 * 1000),
        ]);
        const hints = await detector.detect("task-1", cmd);
        expect(hints).toEqual([]);
    });
});
