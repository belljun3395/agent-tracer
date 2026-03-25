export type RuntimeAdapterId =
  | "claude-hook"
  | "codex-skill"
  | "opencode-plugin"
  | "opencode-sse";

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
