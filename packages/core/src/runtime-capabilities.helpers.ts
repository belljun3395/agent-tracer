import { RUNTIME_CAPABILITIES_BY_ID } from "./runtime-capabilities.constants.js";
import type {
  RuntimeAdapterId,
  RuntimeCapabilities,
  RuntimeEvidenceProfile
} from "./runtime-capabilities.types.js";

export function getRuntimeCapabilities(id: RuntimeAdapterId): RuntimeCapabilities {
  return RUNTIME_CAPABILITIES_BY_ID[id];
}

export function listNativeSkillPaths(id: RuntimeAdapterId): readonly string[] {
  return getRuntimeCapabilities(id).nativeSkillPaths;
}

export function getRuntimeEvidenceProfile(id: RuntimeAdapterId): RuntimeEvidenceProfile {
  return getRuntimeCapabilities(id).evidenceProfile;
}

export function resolveRuntimeAdapterId(runtimeSource?: string): RuntimeAdapterId | undefined {
  if (!runtimeSource) return undefined;
  if (runtimeSource in RUNTIME_CAPABILITIES_BY_ID) {
    return runtimeSource as RuntimeAdapterId;
  }

  const normalized = runtimeSource.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized.includes("claude")) return "claude-hook";
  if (normalized.includes("codex")) return "codex-skill";
  if (normalized.includes("opencode") && normalized.includes("bridge")) return "opencode-bridge";
  if (normalized.includes("opencode") && normalized.includes("sse")) return "opencode-sse";
  if (normalized.includes("opencode")) return "opencode-plugin";
  return undefined;
}

const RUNTIME_ADAPTER_ALIASES: Readonly<Record<string, RuntimeAdapterId>> = {
  "claude": "claude-hook",
  "claude-code": "claude-hook",
  "claude-hook": "claude-hook",
  "codex": "codex-skill",
  "codex-cli": "codex-skill",
  "codex-skill": "codex-skill",
  "manual-mcp": "codex-skill",
  "opencode-bridge": "opencode-bridge",
  "opencode": "opencode-plugin",
  "open-code": "opencode-plugin",
  "opencode-cli": "opencode-plugin",
  "opencode-plugin": "opencode-plugin",
  "opencode-sse": "opencode-sse",
  "seed-script": "codex-skill"
};

export function normalizeRuntimeAdapterId(value: string | undefined): RuntimeAdapterId | undefined {
  if (!value) {
    return undefined;
  }

  return RUNTIME_ADAPTER_ALIASES[value.trim().toLowerCase()];
}

export function getKnownRuntimeCapabilities(value: string | undefined): RuntimeCapabilities | undefined {
  const adapterId = normalizeRuntimeAdapterId(value);
  return adapterId ? getRuntimeCapabilities(adapterId) : undefined;
}
