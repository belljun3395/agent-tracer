// Shared primitives
export * from "./shared/string-brands.js";

// Monitoring (core ids + types)
export * from "./monitoring/ids.js";
export * from "./monitoring/types.js";
export * from "./monitoring/utils.js";

// Classification value types (pure)
export * from "./classification/ids.js";
export * from "./classification/types.js";

// Workflow value types (pure)
export * from "./workflow/ids.js";
export * from "./workflow/types.js";
export * from "./workflow/snapshot.js";
export * from "./workflow/context.js";
export * from "./workflow/segments.js";

// Path utilities (pure)
export * from "./paths/utils.js";

// Runtime adapter value types + registry (pure)
export * from "./runtime/capabilities.types.js";
export * from "./runtime/capabilities.registry.js";
export * from "./runtime/capabilities.helpers.js";
export * from "./runtime/evidence.js";
export * from "./runtime/capabilities.defaults.js";

// Auto-register built-in runtime adapters so consumers (server, adapters,
// web-app) don't need an explicit init call. Previously this lived in the
// @monitor/core shim; promoting it to domain preserves the behaviour now
// that callers import leaf packages directly.
import { registerDefaultRuntimeAdapters } from "./runtime/capabilities.defaults.js";
registerDefaultRuntimeAdapters();

// Interop / event-subtype shared contract (pure)
export * from "./interop/event-semantic.js";
