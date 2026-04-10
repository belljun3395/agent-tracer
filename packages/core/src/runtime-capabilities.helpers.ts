import { getRegisteredAdapters, getRegisteredAliases, } from "./runtime-capabilities.constants.js";
import { RuntimeAdapterId, type RuntimeCapabilities, type RuntimeEvidenceProfile } from "./runtime-capabilities.types.js";
export function getRuntimeCapabilities(id: RuntimeAdapterId | string): RuntimeCapabilities | undefined {
    const adapters = getRegisteredAdapters();
    return adapters.get(id as RuntimeAdapterId);
}
export function listNativeSkillPaths(id: RuntimeAdapterId | string): readonly string[] {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.nativeSkillPaths ?? [];
}
export function getRuntimeEvidenceProfile(id: RuntimeAdapterId | string): RuntimeEvidenceProfile | undefined {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.evidenceProfile;
}
export function normalizeRuntimeAdapterId(value: string | undefined): RuntimeAdapterId | undefined {
    if (!value) {
        return undefined;
    }
    const normalized = RuntimeAdapterId(value);
    const adapters = getRegisteredAdapters();
    if (adapters.has(normalized)) {
        return normalized;
    }
    const aliases = getRegisteredAliases();
    return aliases.get(normalized);
}
export function getKnownRuntimeCapabilities(value: string | undefined): RuntimeCapabilities | undefined {
    const adapterId = normalizeRuntimeAdapterId(value);
    return adapterId ? getRuntimeCapabilities(adapterId) : undefined;
}
