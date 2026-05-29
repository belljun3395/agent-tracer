import path from "node:path";
import { fileURLToPath } from "node:url";
export { createNestMonitorRuntime } from "./main/bootstrap/create-nestjs-monitor-runtime.js";
export type { MonitorRuntime } from "./main/bootstrap/runtime.type.js";
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);
if (entryPath === modulePath) {
    const { createNestMonitorRuntime } = await import("./main/bootstrap/create-nestjs-monitor-runtime.js");
    const runtime = await createNestMonitorRuntime();
    const { host, port, publicBaseUrl, databasePath } = runtime.listen;
    runtime.server.listen(port, host, () => {
        // CLI startup banner — written to stdout regardless of NestJS log level.
        process.stdout.write(`[nestjs-server] listening on ${publicBaseUrl}\n`);
        process.stdout.write(`[nestjs-server] database: ${databasePath}\n`);
    });
}
