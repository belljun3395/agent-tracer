import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApplicationConfig, resolveMonitorDatabasePath, resolveMonitorHttpBaseUrl, resolveMonitorListenHost, resolveMonitorPort } from "@monitor/runtime-config";
export { createNestMonitorRuntime } from "./bootstrap/create-nestjs-monitor-runtime.js";
export type { MonitorRuntime, RuntimeOptions } from "./bootstrap/runtime.types.js";
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);
if (entryPath === modulePath) {
    const { createNestMonitorRuntime } = await import("./bootstrap/create-nestjs-monitor-runtime.js");
    const applicationConfig = loadApplicationConfig();
    const port = resolveMonitorPort(applicationConfig, process.env);
    const listenHost = resolveMonitorListenHost(applicationConfig, process.env);
    const databasePath = resolveMonitorDatabasePath(applicationConfig, { cwd: process.cwd(), env: process.env });
    const publicBaseUrl = resolveMonitorHttpBaseUrl(applicationConfig, process.env);
    const runtime = await createNestMonitorRuntime({ databasePath });
    runtime.server.listen(port, listenHost, () => {
        console.log(`[nestjs-server] listening on ${publicBaseUrl}`);
        console.log(`[nestjs-server] database: ${databasePath}`);
    });
}
