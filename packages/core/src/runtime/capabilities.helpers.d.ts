import { RuntimeAdapterId, type RuntimeCapabilities, type RuntimeEvidenceProfile } from "./capabilities.types.js";
/**
 * Looks up the registered capability record for a runtime adapter id.
 */
export declare function getRuntimeCapabilities(id: RuntimeAdapterId | string): RuntimeCapabilities | undefined;
/**
 * Lists native skill discovery roots advertised by a runtime adapter.
 */
export declare function listNativeSkillPaths(id: RuntimeAdapterId | string): readonly string[];
/**
 * Retrieves the evidence coverage profile attached to a runtime adapter.
 */
export declare function getRuntimeEvidenceProfile(id: RuntimeAdapterId | string): RuntimeEvidenceProfile | undefined;
/**
 * Normalizes a runtime identifier by resolving aliases to a canonical adapter id.
 */
export declare function normalizeRuntimeAdapterId(value: string | undefined): RuntimeAdapterId | undefined;
/**
 * Resolves runtime capabilities from any accepted runtime source string.
 */
export declare function getKnownRuntimeCapabilities(value: string | undefined): RuntimeCapabilities | undefined;
//# sourceMappingURL=capabilities.helpers.d.ts.map