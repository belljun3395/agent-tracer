import { registerDefaultRuntimeAdapters } from "./runtime.js";
export * from "./monitoring.js";
export * from "./classification.js";
export * from "./interop.js";
export * from "./paths.js";
export * from "./runtime.js";
export * from "./workflow.js";

// Auto-register built-in adapters so consumers don't need an explicit init call.
registerDefaultRuntimeAdapters();

/**
 * Re-installs the built-in runtime adapter registry entries.
 * Calling this is optional — adapters are registered automatically on import.
 */
export function initializeDefaultAdapters(): void {
    registerDefaultRuntimeAdapters();
}
