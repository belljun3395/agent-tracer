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
        process.stdout.write(`[nestjs-server] listening on ${publicBaseUrl}\n`);
        process.stdout.write(`[nestjs-server] database: ${database}\n`);
    });

    // 종료 신호를 받으면 HTTP, WS, Redis/Postgres 연결을 같은 경로로 닫아 요청 중단을 줄인다.
    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        process.stdout.write(`[nestjs-server] ${signal} received — shutting down\n`);

        // 종료가 멈추면 오케스트레이터의 강제 종료보다 먼저 프로세스를 확정 종료한다.
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
