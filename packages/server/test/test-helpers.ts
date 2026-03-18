import path from "node:path";
import { fileURLToPath } from "node:url";

import { MonitorService } from "../src/application/monitor-service.js";
import { createMonitorRuntime } from "../src/bootstrap/create-monitor-runtime.js";
import { createSqliteMonitorPorts } from "../src/infrastructure/sqlite/index.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const rulesDir = path.join(repoRoot, "rules");

export function createServiceHarness() {
  const ports = createSqliteMonitorPorts({
    databasePath: ":memory:",
    rulesDir
  });

  return {
    service: new MonitorService(ports),
    close: () => ports.close()
  };
}

export function createRuntimeHarness() {
  return createMonitorRuntime({
    databasePath: ":memory:",
    rulesDir
  });
}
