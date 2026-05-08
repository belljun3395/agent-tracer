import { EmptyView } from "~features/shell/index.js";

/**
 * `/tasks` — sidebar visible, no task selected. Uses the shared EmptyView
 * so the same component handles future "no inspect target" / "no result"
 * panels.
 */
export default function TasksRoute() {
  return (
    <EmptyView
      eyebrow="No task selected"
      title="Pick a task from the sidebar"
      description="Each task collects every Claude Code or Codex action in time order. Open one to follow it as it runs."
    />
  );
}
