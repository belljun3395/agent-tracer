import { describe, expect, it } from "vitest";
import { buildResumeCommand } from "@monitor/web-core";
describe("buildResumeCommand", () => {
    it("returns null when sessionId is missing", () => {
        expect(buildResumeCommand("claude-plugin", undefined)).toBeNull();
        expect(buildResumeCommand("claude-plugin", "")).toBeNull();
    });
    it("returns null for unknown runtime source", () => {
        expect(buildResumeCommand("unknown", "abc")).toBeNull();
        expect(buildResumeCommand(undefined, "abc")).toBeNull();
    });
    it("builds claude command for claude-plugin source", () => {
        expect(buildResumeCommand("claude-plugin", "uuid-123")).toEqual({
            label: "Claude Code",
            command: "claude --resume uuid-123"
        });
    });
    it("keeps legacy claude-hook aliases resumable", () => {
        expect(buildResumeCommand("claude-hook", "uuid-123")).toEqual({
            label: "Claude Code",
            command: "claude --resume uuid-123"
        });
    });
});
