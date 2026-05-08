import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../layout/AppShell.js";
import TasksRoute from "./tasks-route.js";
import TaskRoute from "./task-route.js";
import RulesRoute from "./rules-route.js";
import NotFound from "./not-found.js";

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
      { path: "rules", element: <RulesRoute /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
