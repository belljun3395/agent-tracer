import { registerDefaultRuntimeAdapters } from "./runtime-capabilities.defaults.js";

export * from "./action-registry.js";
export * from "./classifier.js";
export * from "./domain.js";
export * from "./evidence.js";
export * from "./errors.js";
export * from "./path-utils.js";
export * from "./runtime-capabilities.js";
export * from "./openinference.js";
export * from "./workflow-context.js";
export * from "./workflow-snapshot.js";

/**
 * Registers all default runtime adapters.
 * Call this once during application initialization instead of relying on
 * the module-load side effect (which has been removed to improve tree-shaking
 * and test isolation).
 */
export function initializeDefaultAdapters(): void {
  registerDefaultRuntimeAdapters();
}
