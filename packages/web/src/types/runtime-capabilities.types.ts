export type RuntimeAdapterId = string & { readonly __brand: "RuntimeAdapterId" };

export const RuntimeAdapterId = (value: string): RuntimeAdapterId =>
    value.trim().toLowerCase() as RuntimeAdapterId;

export const CLAUDE_PLUGIN_SOURCE = "claude-plugin" as const;
export const CLAUDE_HOOK_SOURCE = "claude-hook" as const;
export const CLAUDE_BRIDGE_SOURCE = "claude-bridge" as const;
export const CODEX_CLI_SOURCE = "codex-cli" as const;

export const CLAUDE_PLUGIN_ADAPTER_ID: RuntimeAdapterId = RuntimeAdapterId(CLAUDE_PLUGIN_SOURCE);
export const CODEX_CLI_ADAPTER_ID: RuntimeAdapterId = RuntimeAdapterId(CODEX_CLI_SOURCE);

export type EvidenceStrength =
  | "proven"
  | "inferred"
  | "self_reported"
  | "unavailable";

export type RuntimeEvidenceFeatureId =
  | "raw_user_prompt"
  | "assistant_response"
  | "exploration_activity"
  | "tool_activity"
  | "mcp_coordination"
  | "subagents_background"
  | "todo_tracking"
  | "context_checkpoints"
  | "agent_thinking"
  | "instruction_context"
  | "session_lifecycle";

export interface RuntimeEvidenceFeature {
  readonly id: RuntimeEvidenceFeatureId;
  readonly label: string;
  readonly evidence: EvidenceStrength;
  readonly note: string;
  readonly automatic: boolean;
}

export interface RuntimeEvidenceProfile {
  readonly defaultEvidence: EvidenceStrength;
  readonly summary: string;
  readonly features: readonly RuntimeEvidenceFeature[];
}

/**
 * Alias for {@link EvidenceStrength}. Retained so consumers that previously
 * imported `EvidenceLevel` from the application layer can migrate to the
 * domain without renaming. Both types describe the same four-value union.
 */
export type EvidenceLevel = EvidenceStrength;

/**
 * Per-feature evidence coverage row surfaced to UI and reporting consumers.
 * Kept in domain so `web-domain` can depend on this shape without importing
 * from the application layer.
 */
export interface RuntimeCoverageItem {
  readonly key: RuntimeEvidenceFeatureId | "semantic_events";
  readonly label: string;
  readonly level: EvidenceLevel;
  readonly note: string;
  readonly automatic?: boolean;
}

export interface RuntimeCapabilities {
  readonly adapterId: RuntimeAdapterId;
  readonly canCaptureRawUserMessage: boolean;
  readonly canObserveToolCalls: boolean;
  readonly canObserveSubagents: boolean;
  readonly hasNativeSkillDiscovery: boolean;
  readonly hasEventStream: boolean;
  readonly endTaskOnSessionClose: "never" | "primary-only" | "always";
  readonly nativeSkillPaths: readonly string[];
  readonly evidenceProfile: RuntimeEvidenceProfile;
}
