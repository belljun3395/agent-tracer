import { RulesPage } from "~features/rules/index.js";

/**
 * `/rules` — workspace rules dashboard. Shares the AppShell so the
 * sidebar (task list) stays visible; the main pane swaps from
 * Operator-view to RulesPage.
 */
export default function RulesRoute() {
  return <RulesPage />;
}
