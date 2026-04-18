// Provider component that gives the React tree access to the shared
// QueryClient. Accepts an optional `client` prop so tests (and the
// router, later) can inject their own instance.

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createMonitorQueryClient } from "./client.js";

export interface QueryProviderProps {
    readonly children: ReactNode;
    readonly client?: QueryClient;
}

export function QueryProvider({ children, client }: QueryProviderProps): ReactNode {
    const [fallbackClient] = useState<QueryClient>(() => createMonitorQueryClient());
    const resolved = client ?? fallbackClient;
    return <QueryClientProvider client={resolved}>{children}</QueryClientProvider>;
}
