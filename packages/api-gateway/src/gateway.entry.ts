import path from "node:path";
import { fileURLToPath } from "node:url";
export { createNestMonitorRuntime } from "./main/bootstrap/create-nestjs-monitor-runtime.js";
export type { MonitorRuntime } from "./main/bootstrap/runtime.type.js";
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);
if (entryPath === modulePath) {
    const { createNestMonitorRuntime } = await import("./main/bootstrap/create-nestjs-monitor-runtime.js");
    const runtime = await createNestMonitorRuntime();
    const { host, port, publicBaseUrl, database } = runtime.listen;
    runtime.server.listen(port, host, () => {
        // CLI startup banner — written to stdout regardless of NestJS log level.
        process.stdout.write(`[nestjs-server] listening on ${publicBaseUrl}\n`);
        process.stdout.write(`[nestjs-server] database: ${database}\n`);
    });

    // Graceful shutdown. Without this, Node's default SIGTERM behaviour is to
    // exit immediately, so on a deploy / scale-down in-flight HTTP requests are
    // cut mid-response, WS clients get a TCP reset instead of a close frame, and
    // the Redis/Postgres connections are never drained. `runtime.close()` already
    // composes the full teardown (nestApp.close() drains the HTTP server and
    // fires the DI shutdown hooks; wsGateway.close() quits Redis and closes the
    // socket server) — we just need to trigger it on the orchestrator's signal.
    //
    // Signals are handled here (rather than via Nest's enableShutdownHooks) so
    // the externally-owned WsGateway is torn down in the same path as the Nest
    // app; enableShutdownHooks would only close the DI container.
    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        process.stdout.write(`[nestjs-server] ${signal} received — shutting down\n`);
        // Safety net: if a connection hangs and close() stalls, force-exit before
        // the orchestrator escalates to SIGKILL (K8s default grace is 30s).
        const forceExit = setTimeout(() => {
            process.stderr.write("[nestjs-server] graceful shutdown timed out — forcing exit\n");
            process.exit(1);
        }, 10_000);
        forceExit.unref();
        try {
            await runtime.close();
            process.exit(0);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[nestjs-server] shutdown error: ${message}\n`);
            process.exit(1);
        }
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}
