/**
 * Unit tests for buildResumeCommand — the helper that converts a runtime
 * source label + sessionId into a CLI resume command spec the UI can render.
 */

import { describe, expect, it } from "vitest";
import { buildResumeCommand } from "./resume-command.js";

describe("buildResumeCommand", () => {
  it("returns null when sessionId is missing", () => {
    expect(buildResumeCommand("claude-hook", undefined)).toBeNull();
    expect(buildResumeCommand("claude-hook", "")).toBeNull();
  });

  it("returns null for unknown runtime source", () => {
    expect(buildResumeCommand("unknown", "abc")).toBeNull();
    expect(buildResumeCommand(undefined, "abc")).toBeNull();
  });

  it("builds claude command for claude-hook source", () => {
    expect(buildResumeCommand("claude-hook", "uuid-123")).toEqual({
      label: "Claude Code",
      command: "claude --resume uuid-123"
    });
  });

  it("builds claude command for future claude-plugin source", () => {
    expect(buildResumeCommand("claude-plugin", "uuid-123")).toEqual({
      label: "Claude Code",
      command: "claude --resume uuid-123"
    });
  });

  it("returns null for opencode-plugin (OpenCode integration removed)", () => {
    expect(buildResumeCommand("opencode-plugin", "ses_abc")).toBeNull();
  });

  it("builds codex command (positional arg)", () => {
    expect(buildResumeCommand("codex-skill", "01HXYZ")).toEqual({
      label: "Codex",
      command: "codex resume 01HXYZ"
    });
  });
});
