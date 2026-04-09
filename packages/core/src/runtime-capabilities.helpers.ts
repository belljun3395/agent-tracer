import { getRegisteredAdapters, getRegisteredAliases, } from "./runtime-capabilities.constants.js";
import type { RuntimeCapabilities, RuntimeEvidenceProfile } from "./runtime-capabilities.types.js";
export function getRuntimeCapabilities(id: string): RuntimeCapabilities | undefined {
    const adapters = getRegisteredAdapters();
    return adapters.get(id);
}
export function listNativeSkillPaths(id: string): readonly string[] {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.nativeSkillPaths ?? [];
}
export function getRuntimeEvidenceProfile(id: string): RuntimeEvidenceProfile | undefined {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.evidenceProfile;
}
export function resolveRuntimeAdapterId(runtimeSource?: string): string | undefined {
    if (!runtimeSource)
        return undefined;
    const adapters = getRegisteredAdapters();
    if (adapters.has(runtimeSource)) {
        return runtimeSource;
    }
    const normalized = runtimeSource.trim().toLowerCase();
    if (!normalized)
        return undefined;
    const aliases = getRegisteredAliases();
    if (aliases.has(normalized)) {
        return aliases.get(normalized);
    }
    if (normalized.includes("claude"))
        return "claude-plugin";
    return undefined;
}
export function normalizeRuntimeAdapterId(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    const aliases = getRegisteredAliases();
    if (aliases.has(normalized)) {
        return aliases.get(normalized);
    }
    if (normalized.includes("claude")) {
        return "claude-plugin";
    }
    return undefined;
}
export function getKnownRuntimeCapabilities(value: string | undefined): RuntimeCapabilities | undefined {
    const adapterId = normalizeRuntimeAdapterId(value);
    return adapterId ? getRuntimeCapabilities(adapterId) : undefined;
}
