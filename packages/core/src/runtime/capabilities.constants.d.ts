import type { RuntimeAdapterId, RuntimeCapabilities } from "./capabilities.types.js";
/**
 * Registers a runtime adapter as a first-class capability source.
 */
export declare function registerRuntimeAdapter(capabilities: RuntimeCapabilities): void;
/**
 * Registers a lowercase alias that resolves to a canonical runtime adapter id.
 */
export declare function registerRuntimeAdapterAlias(alias: string, adapterId: RuntimeAdapterId): void;
/**
 * Returns a defensive copy of the adapter registry for read-only consumers.
 */
export declare function getRegisteredAdapters(): ReadonlyMap<RuntimeAdapterId, RuntimeCapabilities>;
/**
 * Returns a defensive copy of the runtime alias registry.
 */
export declare function getRegisteredAliases(): ReadonlyMap<string, RuntimeAdapterId>;
//# sourceMappingURL=capabilities.constants.d.ts.map