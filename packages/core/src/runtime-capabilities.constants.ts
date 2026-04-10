import type { RuntimeAdapterId, RuntimeCapabilities } from "./runtime-capabilities.types.js";
const registry = new Map<RuntimeAdapterId, RuntimeCapabilities>();
const aliasRegistry = new Map<string, RuntimeAdapterId>();
export function registerRuntimeAdapter(capabilities: RuntimeCapabilities): void {
    registry.set(capabilities.adapterId, capabilities);
}
export function registerRuntimeAdapterAlias(alias: string, adapterId: RuntimeAdapterId): void {
    aliasRegistry.set(alias.trim().toLowerCase(), adapterId);
}
export function getRegisteredAdapters(): ReadonlyMap<RuntimeAdapterId, RuntimeCapabilities> {
    return new Map(registry);
}
export function getRegisteredAliases(): ReadonlyMap<string, RuntimeAdapterId> {
    return new Map(aliasRegistry);
}
