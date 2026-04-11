import { getRegisteredAdapters, getRegisteredAliases, } from "./capabilities.constants.js";
import { RuntimeAdapterId } from "./capabilities.types.js";
/**
 * Looks up the registered capability record for a runtime adapter id.
 */
export function getRuntimeCapabilities(id) {
    const adapters = getRegisteredAdapters();
    return adapters.get(id);
}
/**
 * Lists native skill discovery roots advertised by a runtime adapter.
 */
export function listNativeSkillPaths(id) {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.nativeSkillPaths ?? [];
}
/**
 * Retrieves the evidence coverage profile attached to a runtime adapter.
 */
export function getRuntimeEvidenceProfile(id) {
    const capabilities = getRuntimeCapabilities(id);
    return capabilities?.evidenceProfile;
}
/**
 * Normalizes a runtime identifier by resolving aliases to a canonical adapter id.
 */
export function normalizeRuntimeAdapterId(value) {
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
export function getKnownRuntimeCapabilities(value) {
    const adapterId = normalizeRuntimeAdapterId(value);
    return adapterId ? getRuntimeCapabilities(adapterId) : undefined;
}
//# sourceMappingURL=capabilities.helpers.js.map