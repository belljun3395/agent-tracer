import { describe, expect, it } from "vitest";
import { getEventEvidence, getRuntimeCoverageSummary, listRuntimeCoverage } from "@monitor/core";
describe("evidence helpers", () => {
    it("treats Claude plugin coverage as proven for automatically observed surfaces", () => {
        const summary = getRuntimeCoverageSummary("claude-plugin");
        expect(summary.defaultLevel).toBe("proven");
        expect(summary.summary).toContain("mechanically observed prompts");
        expect(summary.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: "tool_activity", level: "proven", automatic: true }),
            expect.objectContaining({ key: "mcp_coordination", level: "proven", automatic: true }),
            expect.objectContaining({ key: "subagents_background", level: "proven", automatic: true }),
            expect.objectContaining({ key: "semantic_events", level: "self_reported" })
        ]));
    });
    it("keeps Claude runtime coverage mechanically proven for automatic observer surfaces", () => {
        const items = listRuntimeCoverage("claude-plugin");
        expect(items).toEqual(expect.arrayContaining([
            expect.objectContaining({ key: "raw_user_prompt", level: "proven", automatic: true }),
            expect.objectContaining({ key: "tool_activity", level: "proven", automatic: true }),
            expect.objectContaining({ key: "subagents_background", level: "proven", automatic: true })
        ]));
    });
    it("classifies unknown tool activity as self-reported and Claude tool activity as proven", () => {
        expect(getEventEvidence("custom-runtime", {
            kind: "tool.used",
            lane: "implementation",
            metadata: {}
        }).level).toBe("self_reported");
        expect(getEventEvidence("claude-plugin", {
            kind: "tool.used",
            lane: "implementation",
            metadata: {}
        }).level).toBe("proven");
    });
    it("marks session.ended from Claude plugin as proven via the session_lifecycle capability", () => {
        const evidence = getEventEvidence("claude-plugin", {
            kind: "session.ended",
            lane: "user",
            metadata: { source: "session-end", reason: "prompt_input_exit" }
        });
        expect(evidence.level).toBe("proven");
    });
    it("marks session.ended without a session_lifecycle capability as self-reported", () => {
        const evidence = getEventEvidence("custom-runtime", {
            kind: "session.ended",
            lane: "user",
            metadata: { source: "session-end", reason: "prompt_input_exit" }
        });
        expect(evidence.level).toBe("self_reported");
    });
});
