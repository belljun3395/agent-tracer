import type { RuntimeCapabilities } from "./runtime-capabilities.types.js";
const registry = new Map<string, RuntimeCapabilities>();
const aliasRegistry = new Map<string, string>();
export function registerRuntimeAdapter(capabilities: RuntimeCapabilities): void {
    registry.set(capabilities.adapterId, capabilities);
}
export function registerRuntimeAdapterAlias(alias: string, adapterId: string): void {
    aliasRegistry.set(alias.trim().toLowerCase(), adapterId);
}
export function getRegisteredAdapters(): ReadonlyMap<string, RuntimeCapabilities> {
    return new Map(registry);
}
export function getRegisteredAliases(): ReadonlyMap<string, string> {
    return new Map(aliasRegistry);
}
export function getRegisteredAdapterIds(): readonly string[] {
    return Array.from(registry.keys());
}
export function resetRuntimeRegistry(): void {
    registry.clear();
    aliasRegistry.clear();
}
