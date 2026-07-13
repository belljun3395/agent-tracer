import { createServer, type Server, type ServerResponse } from "node:http";
import { withDeadline } from "@monitor/platform";

const READINESS_PROBE_TIMEOUT_MS = 1_000;

/** readiness 응답이 살아 있다고 판정하기 전에 확인하는 의존성의 최소 표면이다. */
export interface ReadinessProbe {
    ping(): Promise<void>;
}

function respond(res: ServerResponse, status: number, body: Record<string, unknown>): void {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}

async function checkReady(
    database: ReadinessProbe,
    dependencies: readonly ReadinessProbe[],
    timeoutMs: number,
): Promise<void> {
    await withDeadline(database.ping(), timeoutMs, "tracer-db readiness probe");
    for (const dependency of dependencies) {
        await withDeadline(dependency.ping(), timeoutMs, "projector dependency readiness probe");
    }
}

/** HTTP API가 없는 컨슈머 프로세스에 라이브니스·레디니스 엔드포인트를 제공한다. */
export function startHealthServer(
    port: number,
    host: string,
    database: ReadinessProbe,
    dependencies: readonly ReadinessProbe[] = [],
    readinessTimeoutMs = READINESS_PROBE_TIMEOUT_MS,
): Server {
    const server = createServer((req, res) => {
        if (req.url === "/health") {
            respond(res, 200, { status: "ok" });
            return;
        }
        if (req.url === "/health/ready") {
            checkReady(database, dependencies, readinessTimeoutMs)
                .then(() => respond(res, 200, { status: "ok" }))
                .catch(() => respond(res, 503, { status: "unavailable" }));
            return;
        }
        respond(res, 404, { status: "not-found" });
    });
    server.listen(port, host);
    return server;
}
