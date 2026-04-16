// Factory for the TanStack Query client used by the web app.
//
// Centralized here so tests and Storybook can build isolated clients with
// the same defaults the production app uses. Defaults reflect the plan's
// "server state lives in the query cache" invariant: 30s staleTime so
// background refetches don't thrash, and refetchOnWindowFocus to pick up
// changes when the user returns to the tab.

import { QueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME_MS = 30_000;

export function createMonitorQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: DEFAULT_STALE_TIME_MS,
                refetchOnWindowFocus: true,
                retry: 1
            },
            mutations: {
                retry: 0
            }
        }
    });
}
