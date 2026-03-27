import { MonitorService } from "../src/application/monitor-service.js";
import { createMonitorRuntime } from "../src/bootstrap/create-monitor-runtime.js";
import { createSqliteMonitorPorts } from "../src/infrastructure/sqlite/index.js";

export function createServiceHarness() {
  const ports = createSqliteMonitorPorts({
    databasePath: ":memory:"
  });

  return {
    service: new MonitorService(ports),
    close: () => ports.close()
  };
}

export function createRuntimeHarness() {
  return createMonitorRuntime({
    databasePath: ":memory:"
  });
}
