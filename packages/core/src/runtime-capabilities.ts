export const RUNTIME_ADAPTER_IDS = [
  "claude-hook",
  "codex-skill",
  "opencode-plugin",
  "opencode-sse"
] as const;

export type RuntimeAdapterId = (typeof RUNTIME_ADAPTER_IDS)[number];

export interface RuntimeCapabilities {
  readonly adapterId: RuntimeAdapterId;
  readonly canCaptureRawUserMessage: boolean;
  readonly canObserveToolCalls: boolean;
  readonly canObserveSubagents: boolean;
  readonly hasNativeSkillDiscovery: boolean;
  readonly hasEventStream: boolean;
  readonly endTaskOnSessionClose: "never" | "primary-only" | "always";
  readonly nativeSkillPaths: readonly string[];
}

const RUNTIME_CAPABILITIES_BY_ID: Record<RuntimeAdapterId, RuntimeCapabilities> = {
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

export function getRuntimeCapabilities(id: RuntimeAdapterId): RuntimeCapabilities {
  return RUNTIME_CAPABILITIES_BY_ID[id];
}

export function listNativeSkillPaths(id: RuntimeAdapterId): readonly string[] {
  return getRuntimeCapabilities(id).nativeSkillPaths;
}
