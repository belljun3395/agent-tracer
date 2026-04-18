import { getRegisteredAdapters, getRegisteredAliases, } from "./capabilities.registry.js";
import { RuntimeAdapterId, type RuntimeCapabilities, type RuntimeEvidenceProfile } from "./capabilities.types.js";

/**
 * Looks up the registered capability record for a runtime adapter id.
 */
export function getRuntimeCapabilities(id: RuntimeAdapterId | string): RuntimeCapabilities | undefined {
    const adapters = getRegisteredAdapters();
    return adapters.get(id as RuntimeAdapterId);
}

/**
 * Lists native skill discovery roots advertised by a runtime adapter.
 */
export function listNativeSkillPaths(id: RuntimeAdapterId | string): readonly string[] {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.nativeSkillPaths ?? [];
}

/**
 * Retrieves the evidence coverage profile attached to a runtime adapter.
 */
export function getRuntimeEvidenceProfile(id: RuntimeAdapterId | string): RuntimeEvidenceProfile | undefined {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.evidenceProfile;
}

/**
 * Normalizes a runtime identifier by resolving aliases to a canonical adapter id.
 */
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

/**
 * Resolves runtime capabilities from any accepted runtime source string.
 */
export function getKnownRuntimeCapabilities(value: string | undefined): RuntimeCapabilities | undefined {
    const adapterId = normalizeRuntimeAdapterId(value);
    return adapterId ? getRuntimeCapabilities(adapterId) : undefined;
}
