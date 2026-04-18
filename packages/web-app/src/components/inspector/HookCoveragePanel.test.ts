import { describe, expect, it } from "vitest";
import type { TimelineEvent } from "@monitor/web-domain";
import { computeHookCoverage } from "./HookCoveragePanel.js";

function event(partial: Partial<TimelineEvent> & Pick<TimelineEvent, "id" | "kind">): TimelineEvent {
    return {
        taskId: "task-1" as TimelineEvent["taskId"],
        lane: "implementation",
        title: "",
        metadata: {},
        classification: { lane: "implementation", tags: [], matches: [] },
        createdAt: new Date().toISOString(),
        ...partial,
    } as TimelineEvent;
}

describe("computeHookCoverage", () => {
    it("returns zero counts for an empty timeline but still lists every hook", () => {
        const rows = computeHookCoverage([]);
        expect(rows.length).toBeGreaterThanOrEqual(14);
        for (const row of rows) {
            expect(row.count).toBe(0);
        }
    });

    it("identifies a UserPromptSubmit event by captureMode=raw", () => {
        const rows = computeHookCoverage([
            event({
                id: "e1" as TimelineEvent["id"],
                kind: "user.message",
                lane: "user",
                metadata: { captureMode: "raw" }
            })
        ]);
        const userPrompt = rows.find((r) => r.entry.id === "UserPromptSubmit");
        expect(userPrompt?.count).toBe(1);
    });

    it("identifies PostToolUseFailure via metadata.failed=true", () => {
        const rows = computeHookCoverage([
            event({
                id: "e2" as TimelineEvent["id"],
                kind: "tool.used",
                metadata: { failed: true, toolName: "Bash" }
            })
        ]);
        const failure = rows.find((r) => r.entry.id === "PostToolUseFailure");
        expect(failure?.count).toBe(1);
        // Bash terminal hook should NOT double-count a failed tool as a bash hit
        const bash = rows.find((r) => r.entry.id === "PostToolUse/Bash");
        expect(bash?.count).toBe(0);
    });

    it("infers PreToolUse from any tool activity since the hook emits no event", () => {
        const rowsEmpty = computeHookCoverage([]);
        expect(rowsEmpty.find((r) => r.entry.id === "PreToolUse")?.count).toBe(0);

        const rowsWithTool = computeHookCoverage([
            event({
                id: "e11" as TimelineEvent["id"],
                kind: "tool.used",
                metadata: { toolName: "Edit" }
            }),
            event({
                id: "e12" as TimelineEvent["id"],
                kind: "terminal.command"
            })
        ]);
        expect(rowsWithTool.find((r) => r.entry.id === "PreToolUse")?.count).toBe(2);
    });

    it("identifies SessionEnd from session.ended", () => {
        const rows = computeHookCoverage([
            event({ id: "e3" as TimelineEvent["id"], kind: "session.ended" })
        ]);
        expect(rows.find((r) => r.entry.id === "SessionEnd")?.count).toBe(1);
    });

    it("identifies an InstructionsLoaded hit", () => {
        const rows = computeHookCoverage([
            event({
                id: "e4" as TimelineEvent["id"],
                kind: "instructions.loaded",
                metadata: { attachmentType: "skill_listing", skillCount: 5, isInitial: true }
            })
        ]);
        expect(rows.find((r) => r.entry.id === "InstructionsLoaded")?.count).toBe(1);
    });

    it("identifies SessionStart via context.saved + trigger metadata", () => {
        const rows = computeHookCoverage([
            event({
                id: "e5" as TimelineEvent["id"],
                kind: "context.saved",
                title: "Session started",
                metadata: { trigger: "startup" }
            }),
            event({
                id: "e6" as TimelineEvent["id"],
                kind: "context.saved",
                title: "Session resumed after compact",
                metadata: { trigger: "compact" }
            })
        ]);
        expect(rows.find((r) => r.entry.id === "SessionStart")?.count).toBe(2);
    });

    it("identifies PreCompact via compactPhase=before", () => {
        const rows = computeHookCoverage([
            event({
                id: "e7" as TimelineEvent["id"],
                kind: "context.saved",
                title: "Context compacting",
                metadata: { trigger: "manual", compactPhase: "before" }
            })
        ]);
        expect(rows.find((r) => r.entry.id === "PreCompact")?.count).toBe(1);
        expect(rows.find((r) => r.entry.id === "SessionStart")?.count).toBe(0);
    });

    it("identifies PostCompact via compactPhase=after", () => {
        const rows = computeHookCoverage([
            event({
                id: "e8" as TimelineEvent["id"],
                kind: "context.saved",
                title: "Context compacted",
                metadata: { trigger: "manual", compactPhase: "after" }
            })
        ]);
        expect(rows.find((r) => r.entry.id === "PostCompact")?.count).toBe(1);
        expect(rows.find((r) => r.entry.id === "SessionStart")?.count).toBe(0);
    });

    it("does not treat compact events as SessionStart even though both are context.saved", () => {
        const rows = computeHookCoverage([
            event({
                id: "e9" as TimelineEvent["id"],
                kind: "context.saved",
                metadata: { trigger: "manual", compactPhase: "before" }
            }),
            event({
                id: "e10" as TimelineEvent["id"],
                kind: "context.saved",
                metadata: { trigger: "manual", compactPhase: "after" }
            })
        ]);
        // trigger=manual is NOT in the SessionStart trigger set
        expect(rows.find((r) => r.entry.id === "SessionStart")?.count).toBe(0);
        expect(rows.find((r) => r.entry.id === "PreCompact")?.count).toBe(1);
        expect(rows.find((r) => r.entry.id === "PostCompact")?.count).toBe(1);
    });
});
