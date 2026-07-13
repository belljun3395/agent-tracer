// web 앱이 쓰는 TanStack Query 클라이언트의 팩토리.

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
