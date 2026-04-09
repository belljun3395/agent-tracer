import { initializeDefaultAdapters } from "@monitor/core";

// Register default runtime adapters once for all tests.
// This replaces the side-effect that was previously triggered on module import.
initializeDefaultAdapters();
