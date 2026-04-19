import type { RuntimeAdapterId, RuntimeCapabilities } from "./runtime-capabilities.types.js";
const registry = new Map<RuntimeAdapterId, RuntimeCapabilities>();
const aliasRegistry = new Map<string, RuntimeAdapterId>();

/**
 * Registers a runtime adapter as a first-class capability source.
 */
export function registerRuntimeAdapter(capabilities: RuntimeCapabilities): void {
    registry.set(capabilities.adapterId, capabilities);
}

/**
 * Registers a lowercase alias that resolves to a canonical runtime adapter id.
 */
export function registerRuntimeAdapterAlias(alias: string, adapterId: RuntimeAdapterId): void {
    aliasRegistry.set(alias.trim().toLowerCase(), adapterId);
}

/**
 * Returns a defensive copy of the adapter registry for read-only consumers.
 */
export function getRegisteredAdapters(): ReadonlyMap<RuntimeAdapterId, RuntimeCapabilities> {
    return new Map(registry);
}

/**
 * Returns a defensive copy of the runtime alias registry.
 */
export function getRegisteredAliases(): ReadonlyMap<string, RuntimeAdapterId> {
    return new Map(aliasRegistry);
}
