import { describe, expect, it } from "vitest";

import {
  getEventEvidence,
  getRuntimeCoverageSummary,
  listRuntimeCoverage
} from "@monitor/core";

describe("evidence helpers", () => {
  it("treats Codex coverage as self-reported instead of unavailable for cooperative logging surfaces", () => {
    const summary = getRuntimeCoverageSummary("codex-cli");

    expect(summary.defaultLevel).toBe("self_reported");
    expect(summary.summary).toContain("cooperative self-reporting");
    expect(summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "tool_activity", level: "self_reported", automatic: false }),
        expect.objectContaining({ key: "mcp_coordination", level: "self_reported", automatic: false }),
        expect.objectContaining({ key: "subagents_background", level: "self_reported", automatic: false }),
        expect.objectContaining({ key: "semantic_events", level: "self_reported" })
      ])
    );
  });

  it("keeps Claude runtime coverage mechanically proven for automatic observer surfaces", () => {
    const items = listRuntimeCoverage("claude-hook");

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "raw_user_prompt", level: "proven", automatic: true }),
        expect.objectContaining({ key: "tool_activity", level: "proven", automatic: true }),
        expect.objectContaining({ key: "subagents_background", level: "proven", automatic: true })
      ])
    );
  });

  it("classifies Codex tool activity as self-reported and Claude tool activity as proven", () => {
    expect(
      getEventEvidence("codex-cli", {
        kind: "tool.used",
        lane: "implementation",
        metadata: {}
      }).level
    ).toBe("self_reported");

    expect(
      getEventEvidence("claude-hook", {
        kind: "tool.used",
        lane: "implementation",
        metadata: {}
      }).level
    ).toBe("proven");
  });
});
