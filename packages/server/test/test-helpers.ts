import { MonitorService } from "../src/application/monitor-service.js";
import { createNestMonitorRuntime } from "@monitor/server";
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
    return createNestMonitorRuntime({
        databasePath: ":memory:"
    });
}
