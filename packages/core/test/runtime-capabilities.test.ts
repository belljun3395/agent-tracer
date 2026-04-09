import { describe, expect, it } from "vitest";

import {
  getRuntimeEvidenceProfile,
  getRuntimeCapabilities,
  listNativeSkillPaths,
  normalizeRuntimeAdapterId,
  RUNTIME_ADAPTER_IDS
} from "@monitor/core";

describe("runtime capabilities", () => {
  it("defines the supported adapter ids", () => {
    expect(RUNTIME_ADAPTER_IDS).toEqual([
      "claude-hook",
      "codex-skill"
    ]);
  });

  it("keeps Claude raw capture enabled without auto-completing primary tasks", () => {
    const capabilities = getRuntimeCapabilities("claude-hook")!;

    expect(capabilities.canCaptureRawUserMessage).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(true);
    expect(capabilities.endTaskOnSessionClose).toBe("never");
    expect(capabilities.nativeSkillPaths).toEqual([".claude/skills"]);
  });

  it("marks Codex skill monitoring as native-skill based but not hook-observed", () => {
    const capabilities = getRuntimeCapabilities("codex-skill")!;
    const evidenceProfile = getRuntimeEvidenceProfile("codex-skill")!;

    expect(capabilities.hasNativeSkillDiscovery).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(false);
    expect(capabilities.canObserveSubagents).toBe(false);
    expect(listNativeSkillPaths("codex-skill")).toEqual([".agents/skills"]);
    expect(evidenceProfile.defaultEvidence).toBe("self_reported");
    expect(evidenceProfile.features.some((feature) => feature.evidence === "self_reported")).toBe(true);
  });

  it("normalizes legacy runtime aliases", () => {
    expect(normalizeRuntimeAdapterId("codex-cli")).toBe("codex-skill");
    expect(normalizeRuntimeAdapterId("manual-mcp")).toBe("codex-skill");
    expect(normalizeRuntimeAdapterId("claude-code")).toBe("claude-hook");
    expect(normalizeRuntimeAdapterId("claude")).toBe("claude-hook");
  });
});
