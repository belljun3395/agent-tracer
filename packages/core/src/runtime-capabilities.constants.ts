import type { RuntimeAdapterId, RuntimeCapabilities } from "./runtime-capabilities.types.js";

export const RUNTIME_ADAPTER_IDS: readonly RuntimeAdapterId[] = [
  "claude-hook",
  "codex-hook",
  "codex-skill",
  "opencode-plugin",
  "opencode-sse"
] as const;

export const RUNTIME_CAPABILITIES_BY_ID: Record<RuntimeAdapterId, RuntimeCapabilities> = {
  "claude-hook": {
    adapterId: "claude-hook",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "never",
    nativeSkillPaths: [".claude/skills"]
  },
  "codex-hook": {
    adapterId: "codex-hook",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: false,
    hasNativeSkillDiscovery: false,
    hasEventStream: false,
    endTaskOnSessionClose: "always",
    nativeSkillPaths: []
  },
  "codex-skill": {
    adapterId: "codex-skill",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: false,
    canObserveSubagents: false,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "never",
    nativeSkillPaths: [".agents/skills"]
  },
  "opencode-plugin": {
    adapterId: "opencode-plugin",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: false,
    endTaskOnSessionClose: "primary-only",
    nativeSkillPaths: [".agents/skills", ".claude/skills"]
  },
  "opencode-sse": {
    adapterId: "opencode-sse",
    canCaptureRawUserMessage: true,
    canObserveToolCalls: true,
    canObserveSubagents: true,
    hasNativeSkillDiscovery: true,
    hasEventStream: true,
    endTaskOnSessionClose: "primary-only",
    nativeSkillPaths: [".agents/skills", ".claude/skills"]
  }
};
