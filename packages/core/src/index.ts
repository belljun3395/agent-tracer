import { registerDefaultRuntimeAdapters } from "./runtime.js";
export * from "./monitoring.js";
export * from "./classification.js";
export * from "./interop.js";
export * from "./paths.js";
export * from "./runtime.js";
export * from "./workflow.js";

/**
 * Installs the built-in runtime adapter registry entries used by the package.
 */
export function initializeDefaultAdapters(): void {
    registerDefaultRuntimeAdapters();
}
