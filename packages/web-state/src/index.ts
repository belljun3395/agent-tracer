// @monitor/web-state — React-facing state layer for the web surface.
//
// This package owns the three state concerns laid out in the blackbox
// redesign plan: (1) server state via TanStack Query, (2) ephemeral UI
// state via Zustand slices, (3) WebSocket → query invalidation plumbing.
//
// Depends on web-io for browser-boundary adapters and on web-domain for
// pure domain logic. May import React. Must not import from @monitor/web-app.

export { createMonitorQueryClient } from "./query/client.js";
export { QueryProvider } from "./query/QueryProvider.js";
export type { QueryProviderProps } from "./query/QueryProvider.js";

export { monitorQueryKeys } from "./server/queryKeys.js";
export type { MonitorQueryKey } from "./server/queryKeys.js";
export {
    useOverviewQuery,
    useTasksQuery,
    useTaskDetailQuery,
    useBookmarksQuery
} from "./server/queries.js";
export { useTaskObservability } from "./server/observability.js";

export { useMonitorSocket } from "./realtime/useMonitorSocket.js";
export type { UseMonitorSocketOptions } from "./realtime/useMonitorSocket.js";

// Ephemeral UI stores (Zustand)
export { useSelectionStore } from "./ui/useSelectionStore.js";
export type { SelectionState } from "./ui/useSelectionStore.js";
export { useEditStore } from "./ui/useEditStore.js";
export type { EditState } from "./ui/useEditStore.js";
export { useNowMs } from "./ui/useNowMs.js";

export * from "./useEvaluation.js";
export * from "./useSearch.js";
