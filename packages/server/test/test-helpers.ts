import { MonitorService } from "../src/application/monitor-service.js";
import { createMonitorRuntime } from "@monitor/server";
import { createSqliteMonitorPorts } from "../src/infrastructure/sqlite";

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
