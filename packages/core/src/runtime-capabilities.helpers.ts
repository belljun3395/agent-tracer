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
export function resolveRuntimeAdapterId(runtimeSource?: string): RuntimeAdapterId | undefined {
    if (!runtimeSource)
        return undefined;
    const adapters = getRegisteredAdapters();
    const asAdapterId = runtimeSource as RuntimeAdapterId;
    if (adapters.has(asAdapterId)) {
        return asAdapterId;
    }
    const normalized = runtimeSource.trim().toLowerCase();
    if (!normalized)
        return undefined;
    const aliases = getRegisteredAliases();
    return aliases.get(normalized);
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
