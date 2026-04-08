import type { RuntimeCapabilities } from "./runtime-capabilities.types.js";

// Mutable registry for runtime adapters
const registry = new Map<string, RuntimeCapabilities>();

// Mutable registry for adapter aliases
const aliasRegistry = new Map<string, string>();

/**
 * Registers a runtime adapter with its capabilities.
 * @param capabilities The runtime capabilities to register
 */
export function registerRuntimeAdapter(capabilities: RuntimeCapabilities): void {
  registry.set(capabilities.adapterId, capabilities);
}

/**
 * Registers an alias for a runtime adapter ID.
 * @param alias The alias string
 * @param adapterId The canonical adapter ID to resolve to
 */
export function registerRuntimeAdapterAlias(alias: string, adapterId: string): void {
  aliasRegistry.set(alias.trim().toLowerCase(), adapterId);
}

/**
 * Returns all registered runtime adapters as a read-only map.
 */
export function getRegisteredAdapters(): ReadonlyMap<string, RuntimeCapabilities> {
  return new Map(registry);
}

/**
 * Returns all registered aliases as a read-only map.
 */
export function getRegisteredAliases(): ReadonlyMap<string, string> {
  return new Map(aliasRegistry);
}

/**
 * Gets the IDs of all registered adapters.
 */
export function getRegisteredAdapterIds(): readonly string[] {
  return Array.from(registry.keys());
}
