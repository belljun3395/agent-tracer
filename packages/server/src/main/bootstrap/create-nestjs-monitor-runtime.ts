import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import type express from "express";
import { createClient } from "redis";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { WebSocketServer, type WebSocket } from "ws";

initializeTransactionalContext();
import { AppModule } from "../presentation/app.module.js";
import { setupSwagger } from "../presentation/swagger.js";
import { AppConfigService } from "~config/app-config.service.js";
import { loadApplicationConfig } from "~config/application-config.js";
import { runWithUser, DEFAULT_USER_ID } from "@monitor/shared-kernel/user/user.context.js";
import { EventBroadcasterService } from "~adapters/realtime/ws/event.broadcaster.service.js";
import { RedisNotificationPublisher } from "~adapters/realtime/redis.notification.publisher.js";
import { RedisFanoutSubscriber } from "~adapters/realtime/redis.fanout.subscriber.js";
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import { tallyTaskStatuses } from "@monitor/work/task/public/helpers.js";
import type { ITaskLifecycle } from "@monitor/work/task/public/iservice/task.lifecycle.iservice.js";
import type { ITaskSnapshotQuery } from "@monitor/work/task/public/iservice/task.snapshot.query.iservice.js";
import type { TaskSnapshot } from "@monitor/work/task/public/dto/task.snapshot.dto.js";
import { TASK_LIFECYCLE, TASK_SNAPSHOT_QUERY } from "@monitor/work/task/public/tokens.js";
import type { MonitorRuntime } from "./runtime.type.js";

export async function createNestMonitorRuntime(): Promise<MonitorRuntime> {
    // 알림은 Redis pub/sub 으로 흐른다: 발행자는 대상 userId 와 함께 채널에 publish 하고,
    // 구독자가 이 파드의 해당 사용자 소켓으로 fan-out 한다(멀티파드/무상태).
    const redisUrl = loadApplicationConfig().redis.url;
    const redisPublisher = createClient({ url: redisUrl });
    const redisSubscriber = redisPublisher.duplicate();
    await redisPublisher.connect();
    await redisSubscriber.connect();
    const broadcaster = new EventBroadcasterService();
    const notifier = new RedisNotificationPublisher(redisPublisher);
    await new RedisFanoutSubscriber(redisSubscriber, broadcaster).start();
    const nestApp = await NestFactory.create<NestExpressApplication>(
        AppModule.forRoot({ notifier }),
        { logger: ["error", "warn"] },
    );
    // Resolved once from the DI-managed config so the listen address and startup
    // banner come from the same source the rest of the app reads (no second
    // loadApplicationConfig() in the entrypoint).
    const appConfig = nestApp.get(AppConfigService);
    const pg = appConfig.postgres;
    const listen = {
        host: appConfig.resolveListenHost(),
        port: appConfig.resolvePort(),
        publicBaseUrl: appConfig.resolveHttpBaseUrl(),
        database: `postgres://${pg.host}:${pg.port}/${pg.database}`,
    };
    setupSwagger(nestApp);
    // Raise the body limit above Express's 100kb default: a 100-event batch with
    // real tool output (Bash results, file contents) easily exceeds it and would
    // otherwise be rejected at the parser.
    nestApp.useBodyParser("json", { limit: "8mb" });
    nestApp.useBodyParser("urlencoded", { limit: "8mb", extended: true });
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    configureTrustedProxy(app);
    const server = nestApp.getHttpServer();
    // Clients only ever send tiny control frames; cap inbound payloads far below
    // ws's 100 MiB default so a single oversized frame can't exhaust memory.
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1 * 1024 * 1024 });
    server.on("upgrade", (request, socket, head) => {
        const requestUrl = request.url ?? "/";
        const { pathname } = new URL(requestUrl, "http://localhost");
        const context = createUpgradeRequestContext(request);
        const userAgentHeader = request.headers["user-agent"];
        const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
        const originHeader = request.headers["origin"];
        const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
        assignRequestContext(request as RequestContextIncomingMessage, context);
        // Browsers do NOT enforce same-origin for WebSocket, so without a check
        // any page the user visits could open /ws and read the live event stream
        // (task titles, workspace paths). Allow native clients (no Origin header,
        // e.g. the runtime daemon) and loopback origins; gate everything else
        // behind an explicit opt-in for intentionally-exposed deployments.
        const accepted = pathname === "/ws" && isWsOriginAllowed(origin);
        logHttpUpgrade({
            type: "http_upgrade",
            requestId: context.requestId,
            path: pathname,
            accepted,
            clientIp: context.clientIp,
            ...(userAgent ? { userAgent } : {}),
        });
        if (accepted) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
            return;
        }
        socket.destroy();
    });
    const taskSnapshots = nestApp.get<ITaskSnapshotQuery>(TASK_SNAPSHOT_QUERY);
    // 연결마다 그 사용자 범위(runWithUser)에서 초기 스냅샷을 만든다. 공유 캐시는
    // 두지 않는다(사용자별 데이터 + 무상태). 라이브 업데이트는 fan-out 으로 온다.
    wss.on("connection", (ws, request) => {
        const userId = extractWsUserId(request.url);
        broadcaster.addClient(ws, userId);
        // Heartbeat liveness: ws does NOT auto-detect dead peers, so a client
        // that vanishes without a clean close (laptop sleep, Wi-Fi drop) would
        // otherwise linger in the registry forever. The interval below pings
        // and reaps any socket that missed the previous pong.
        const tracked = ws as WebSocket & { isAlive?: boolean };
        tracked.isAlive = true;
        ws.on("pong", () => { tracked.isAlive = true; });
        ws.on("close", () => broadcaster.removeClient(ws));
        // A ws socket that emits 'error' with no listener throws and crashes the
        // whole process (taking ingest down with it). Drop the client instead.
        ws.on("error", () => broadcaster.drop(ws));
        void runWithUser(userId, () => createInitialSnapshot(taskSnapshots))
            .then((payload) => {
                if (ws.readyState !== 1) return;
                ws.send(JSON.stringify({ type: "snapshot", payload }));
            })
            .catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                process.stderr.write(`[nestjs-server] initial snapshot failed: ${message}\n`);
                broadcaster.drop(ws);
            });
    });
    const HEARTBEAT_MS = 30_000;
    const heartbeat = setInterval(() => {
        for (const client of broadcaster.connections) {
            const tracked = client as WebSocket & { isAlive?: boolean };
            if (tracked.isAlive === false) {
                broadcaster.drop(client);
                continue;
            }
            tracked.isAlive = false;
            try {
                client.ping();
            } catch {
                broadcaster.drop(client);
            }
        }
    }, HEARTBEAT_MS);
    heartbeat.unref();
    await nestApp.init();
    const taskLifecycle = nestApp.get<ITaskLifecycle>(TASK_LIFECYCLE);
    await reapStuckServerSdkTasks(taskSnapshots, taskLifecycle);
    return {
        app,
        server,
        wss,
        listen,
        close: async () => {
            clearInterval(heartbeat);
            await nestApp.close();
            await redisSubscriber.quit().catch(() => undefined);
            await redisPublisher.quit().catch(() => undefined);
            await new Promise<void>((resolve) => {
                wss.close(() => resolve());
            });
        }
    };
}

/**
 * WebSocket upgrade origin policy. Native clients (the runtime daemon, curl)
 * send no Origin header and are always allowed; browser connections are
 * restricted to loopback origins to block cross-site WebSocket hijacking.
 * Set MONITOR_WS_ALLOW_ANY_ORIGIN=1 for an intentionally network-exposed
 * dashboard served from a non-loopback host.
 */
/** WS 연결 URL 쿼리에서 userId 를 추출한다(없으면 기본 사용자). */
function extractWsUserId(url: string | undefined): string {
    try {
        const parsed = new URL(url ?? "/", "http://localhost");
        return parsed.searchParams.get("userId")?.trim() || DEFAULT_USER_ID;
    } catch {
        return DEFAULT_USER_ID;
    }
}

function isWsOriginAllowed(origin: string | undefined): boolean {
    if (process.env.MONITOR_WS_ALLOW_ANY_ORIGIN === "1") return true;
    if (!origin) return true;
    try {
        const host = new URL(origin).hostname;
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
    } catch {
        return false;
    }
}

/**
 * Server-SDK tasks (Title Suggestion, Task Cleanup, Recipe Scan, Rule
 * Generation) spawn a short-lived Claude binary subprocess. If the monitor
 * is killed mid-run the SessionEnd hook never fires and the task row stays
 * `running` forever, which (a) misleads the dashboard's stats and (b)
 * blocks the matching `findActiveForTask` lookups in the rule-gen / cleanup
 * job repositories. Sweep them to `errored` on startup — only server-sdk
 * rows are eligible, so user-driven sessions that are actually resuming
 * elsewhere are left alone.
 */
async function reapStuckServerSdkTasks(
    snapshots: ITaskSnapshotQuery,
    lifecycle: ITaskLifecycle,
): Promise<void> {
    const tasks = await snapshots.findAll("active");
    const stuck = tasks.filter(
        (t) => t.origin === "server-sdk" && t.status === "running",
    );
    if (stuck.length === 0) return;
    for (const t of stuck) {
        try {
            await lifecycle.finalizeTask({
                taskId: t.id,
                outcome: "errored",
                summary: "Reaped on monitor restart — server-SDK task was left running.",
                errorMessage: "monitor_restart_reaper",
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write(
                `[nestjs-server] reaper failed for task ${t.id}: ${message}\n`,
            );
        }
    }
    process.stdout.write(
        `[nestjs-server] reaped ${stuck.length} stuck server-sdk task(s) on boot\n`,
    );
}

async function createInitialSnapshot(taskSnapshots: ITaskSnapshotQuery): Promise<{
    readonly stats: ReturnType<typeof tallyTaskStatuses> & { readonly totalEvents: number };
    readonly tasks: readonly TaskSnapshot[];
}> {
    const [statuses, totalEvents, tasks] = await Promise.all([
        taskSnapshots.listTaskStatuses(),
        taskSnapshots.countTimelineEvents(),
        taskSnapshots.findAll(),
    ]);

    return {
        stats: {
            ...tallyTaskStatuses(statuses),
            totalEvents,
        },
        tasks,
    };
}
