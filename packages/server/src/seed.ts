import path from "node:path";

import { MonitorService } from "./application/monitor-service.js";

const databasePath = path.resolve(process.cwd(), ".monitor", "monitor.sqlite");
const rulesDir = path.resolve(process.cwd(), "rules");

const service = new MonitorService({
  databasePath,
  rulesDir
});

const started = service.startTask({
  title: "Build Monitor parity dashboard",
  workspacePath: process.cwd(),
  summary: "Seeded task for local Monitor demo."
});

const { sessionId } = started;

service.logToolUsed({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  toolName: "write_file",
  title: "Implement dashboard shell",
  body: "Built counters, timeline lanes, and inspector drawer.",
  filePaths: [
    "packages/web/src/App.tsx",
    "packages/web/src/styles.css"
  ]
});

service.logPlan({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  action: "plan_rule_guard_overlay",
  body: "Decided to visualize checks, violations, passes, and explored files."
});

service.logAction({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  action: "read_auth_logic",
  body: "Inspected auth flows before wiring new guard events.",
  filePaths: ["packages/server/src/application/monitor-service.ts", "packages/mcp/src/index.ts"]
});

service.logVerification({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  action: "run_test_dashboard_rules",
  result: "PASS 12/12",
  filePaths: ["packages/server/test/application/monitor-service.test.ts", "packages/web/src/App.tsx"]
});

service.logRule({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  action: "check_rule_guard",
  ruleId: "c5-compliance",
  severity: "high",
  status: "violation",
  body: "Rule Guard flagged a missing verification step."
});

service.logTerminalCommand({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  command: "npm run test",
  filePaths: [
    "packages/server/test/application/monitor-service.test.ts",
    "packages/web/src/lib/timeline.test.ts"
  ]
});

service.saveContext({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  title: "Context snapshot",
  body: "Backend, MCP, and dashboard milestones are wired together.",
  filePaths: ["docs/tasks/005-dashboard.md"]
});

service.completeTask({
  taskId: started.task.id,
  ...(sessionId ? { sessionId } : {}),
  summary: "Seed data finished."
});

console.log("Seeded Monitor demo data.");
