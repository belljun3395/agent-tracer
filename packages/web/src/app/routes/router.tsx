import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../layout/AppShell.js";
import TasksRoute from "./tasks-route.js";
import TaskRoute from "./task-route.js";
import NotFound from "./not-found.js";

// Lazy-loaded routes — `/rules` is rarely the first stop, so its
// bundle (form modal, severity chips, list page) shouldn't ride the
// initial paint critical path.
const RulesRoute = lazy(() => import("./rules-route.js"));
const SettingsRoute = lazy(() => import("./settings-route.js"));

function withSuspense(Component: ComponentType, fallback: ReactNode = null) {
  return (
    <Suspense fallback={fallback}>
      <Component />
    </Suspense>
  );
}

/**
 * Routes:
 *   /                 → /tasks
 *   /tasks            → empty main, sidebar visible
 *   /tasks/:taskId    → Operator view (FeedPanel)
 *   /rules            → workspace rules dashboard
 *   *                 → 404
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/tasks" replace /> },
      { path: "tasks", element: <TasksRoute /> },
      { path: "tasks/:taskId", element: <TaskRoute /> },
      { path: "rules", element: withSuspense(RulesRoute) },
      { path: "settings", element: withSuspense(SettingsRoute) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
