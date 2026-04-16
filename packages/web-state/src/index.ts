// @monitor/web-state — React-facing state layer for the web surface.
//
// This package owns the three state concerns laid out in the blackbox
// redesign plan: (1) server state via TanStack Query, (2) ephemeral UI
// state via Zustand slices, (3) WebSocket → query invalidation plumbing.
//
// Depends on web-io for browser-boundary adapters and on web-domain for
// pure domain logic. May import React. Must not import from @monitor/web.

export { createMonitorQueryClient } from "./query/client.js";
export { QueryProvider } from "./query/QueryProvider.js";
export type { QueryProviderProps } from "./query/QueryProvider.js";
