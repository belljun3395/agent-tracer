import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router.js";
import { ThemeProvider } from "~web/app/layout/ThemeProvider.js";
import { AppErrorBoundary } from "~web/app/AppErrorBoundary.js";
import { UiStoreProvider } from "~web/shared/store/index.js";
import { createMonitorQueryClient } from "~web/shared/api/query-client.js";

export default function App() {
  // 재렌더링에도 안정적이다.
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
