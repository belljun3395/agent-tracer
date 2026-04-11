const registry = new Map();
const aliasRegistry = new Map();
/**
 * Registers a runtime adapter as a first-class capability source.
 */
export function registerRuntimeAdapter(capabilities) {
    registry.set(capabilities.adapterId, capabilities);
}
/**
 * Registers a lowercase alias that resolves to a canonical runtime adapter id.
 */
export function registerRuntimeAdapterAlias(alias, adapterId) {
    aliasRegistry.set(alias.trim().toLowerCase(), adapterId);
}
/**
 * Returns a defensive copy of the adapter registry for read-only consumers.
 */
export function getRegisteredAdapters() {
    return new Map(registry);
}
/**
 * Returns a defensive copy of the runtime alias registry.
 */
export function getRegisteredAliases() {
    return new Map(aliasRegistry);
}
//# sourceMappingURL=capabilities.constants.js.map