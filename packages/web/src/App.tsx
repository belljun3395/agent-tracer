import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes/router.js";
import { ThemeProvider } from "./app/layout/ThemeProvider.js";
import { AppErrorBoundary } from "./app/AppErrorBoundary.js";
import { UiStoreProvider } from "~state/ui/index.js";
import { createMonitorQueryClient } from "~state/query/client.js";

export default function App() {
  // Stable across re-renders — created once per mount.
  const [queryClient] = useState(createMonitorQueryClient);

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <UiStoreProvider>
            <RouterProvider router={router} />
          </UiStoreProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
