import { describe, expect, it } from "vitest";

import {
  getRuntimeCapabilities,
  listNativeSkillPaths,
  RUNTIME_ADAPTER_IDS
} from "@monitor/core";

describe("runtime capabilities", () => {
  it("defines the supported adapter ids", () => {
    expect(RUNTIME_ADAPTER_IDS).toEqual([
      "claude-hook",
      "codex-hook",
      "codex-skill",
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

    expect(capabilities.hasNativeSkillDiscovery).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(false);
    expect(capabilities.canObserveSubagents).toBe(false);
    expect(listNativeSkillPaths("codex-skill")).toEqual([".agents/skills"]);
  });

  it("treats Codex hook monitoring as automatic per-turn tracing without native skill discovery", () => {
    const capabilities = getRuntimeCapabilities("codex-hook");

    expect(capabilities.canCaptureRawUserMessage).toBe(true);
    expect(capabilities.canObserveToolCalls).toBe(true);
    expect(capabilities.canObserveSubagents).toBe(false);
    expect(capabilities.hasNativeSkillDiscovery).toBe(false);
    expect(capabilities.endTaskOnSessionClose).toBe("always");
    expect(listNativeSkillPaths("codex-hook")).toEqual([]);
  });

  it("distinguishes OpenCode plugin and SSE observers", () => {
    const plugin = getRuntimeCapabilities("opencode-plugin");
    const sse = getRuntimeCapabilities("opencode-sse");

    expect(plugin.canCaptureRawUserMessage).toBe(true);
    expect(plugin.hasEventStream).toBe(false);
    expect(plugin.endTaskOnSessionClose).toBe("primary-only");

    expect(sse.canCaptureRawUserMessage).toBe(true);
    expect(sse.hasEventStream).toBe(true);
    expect(sse.nativeSkillPaths).toEqual(plugin.nativeSkillPaths);
  });
});
