export type RuntimeAdapterId = string & { readonly __brand: "RuntimeAdapterId" };

export const RuntimeAdapterId = (value: string): RuntimeAdapterId =>
    value.trim().toLowerCase() as RuntimeAdapterId;

export const CLAUDE_PLUGIN_ADAPTER_ID: RuntimeAdapterId = RuntimeAdapterId("claude-plugin");

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
  | "subagents_background";

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
