import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "~web/app/AppShell.js";
import TasksRoute from "~web/pages/tasks/TasksPage.js";
import TaskRoute from "~web/pages/task/TaskPage.js";
import NotFound from "~web/pages/not-found/NotFoundPage.js";
import { RulesPage } from "~web/pages/rules/RulesPage.js";
import { RecipesPage } from "~web/pages/recipes/RecipesPage.js";
import { JobsPage } from "~web/pages/jobs/JobsPage.js";
import { SettingsPage } from "~web/pages/settings/SettingsPage.js";

/**
 * 라우트: `/`는 `/tasks`로, `/tasks`는 사이드바만, `/tasks/:taskId`는 운영자 뷰,
 * 나머지는 워크스페이스 화면이며 매칭되지 않으면 404다.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/tasks" replace /> },
      { path: "tasks", element: <TasksRoute /> },
      { path: "tasks/:taskId", element: <TaskRoute /> },
      { path: "rules", element: <RulesPage /> },
      { path: "recipes", element: <RecipesPage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
