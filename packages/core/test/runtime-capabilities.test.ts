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
      "codex-skill",
      "opencode-bridge",
      "opencode-plugin",
      "opencode-sse"
    ]);
  });

  it("keeps Claude raw capture enabled without auto-completing primary tasks", () => {
    const capabilities = getRuntimeCapabilities("claude-hook");

    expect(capabilities.canCaptureRawUserMessage).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(true);
    expect(capabilities.endTaskOnSessionClose).toBe("never");
    expect(capabilities.nativeSkillPaths).toEqual([".claude/skills"]);
  });

  it("marks Codex skill monitoring as native-skill based but not hook-observed", () => {
    const capabilities = getRuntimeCapabilities("codex-skill");
    const evidenceProfile = getRuntimeEvidenceProfile("codex-skill");

    expect(capabilities.hasNativeSkillDiscovery).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(false);
    expect(capabilities.canObserveSubagents).toBe(false);
    expect(listNativeSkillPaths("codex-skill")).toEqual([".agents/skills"]);
    expect(evidenceProfile.defaultEvidence).toBe("self_reported");
    expect(evidenceProfile.features.some((feature) => feature.evidence === "self_reported")).toBe(true);
  });

  it("distinguishes OpenCode plugin and SSE observers", () => {
    const bridge = getRuntimeCapabilities("opencode-bridge");
    const plugin = getRuntimeCapabilities("opencode-plugin");
    const sse = getRuntimeCapabilities("opencode-sse");

    expect(bridge.canObserveToolCalls).toBe(false);
    expect(bridge.canObserveSubagents).toBe(false);
    expect(bridge.evidenceProfile.defaultEvidence).toBe("self_reported");

    expect(plugin.canCaptureRawUserMessage).toBe(true);
    expect(plugin.hasEventStream).toBe(false);
    expect(plugin.endTaskOnSessionClose).toBe("primary-only");

    expect(sse.canCaptureRawUserMessage).toBe(true);
    expect(sse.hasEventStream).toBe(true);
    expect(sse.nativeSkillPaths).toEqual(plugin.nativeSkillPaths);
  });

  it("normalizes legacy runtime aliases", () => {
    expect(normalizeRuntimeAdapterId("codex-cli")).toBe("codex-skill");
    expect(normalizeRuntimeAdapterId("manual-mcp")).toBe("codex-skill");
    expect(normalizeRuntimeAdapterId("opencode-bridge")).toBe("opencode-bridge");
    expect(normalizeRuntimeAdapterId("opencode")).toBe("opencode-plugin");
    expect(normalizeRuntimeAdapterId("claude-code")).toBe("claude-hook");
    expect(normalizeRuntimeAdapterId("claude")).toBe("claude-hook");
  });
});
