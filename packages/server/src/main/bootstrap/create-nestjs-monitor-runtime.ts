import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { WebSocketServer, type WebSocket } from "ws";

initializeTransactionalContext();
import { AppModule } from "../presentation/app.module.js";
import { EventBroadcasterService } from "~adapters/realtime/ws/event.broadcaster.service.js";
import { LocalNotificationPublisher } from "~adapters/notifications/publishers/local.notification.publisher.js";
import { OsDesktopNotifier } from "~adapters/notifications/os.desktop.notifier.js";
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import { tallyTaskStatuses } from "~work/task/public/helpers.js";
import type { ITaskLifecycle } from "~work/task/public/iservice/task.lifecycle.iservice.js";
import type { ITaskSnapshotQuery } from "~work/task/public/iservice/task.snapshot.query.iservice.js";
import type { TaskSnapshot } from "~work/task/public/dto/task.snapshot.dto.js";
import { TASK_LIFECYCLE, TASK_SNAPSHOT_QUERY } from "~work/task/public/tokens.js";
import type { RuntimeOptions, MonitorRuntime } from "./runtime.type.js";

export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
    const broadcaster = new EventBroadcasterService();
    const osNotifier = new OsDesktopNotifier();
    const notifier = new LocalNotificationPublisher(broadcaster, osNotifier);
    const nestApp = await NestFactory.create<NestExpressApplication>(
        AppModule.forRoot({ databasePath: options.databasePath, notifier }),
        { logger: ["error", "warn"] },
    );
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
    // Snapshot cache + in-flight coalescing: building the initial snapshot scans
    // every active task, so a reconnect storm (all dashboards reconnecting after
    // a restart) would otherwise stampede the single SQLite connection with one
    // full build per client. Share one build within a short window; live updates
    // still arrive via fan-out, so a ~1s-stale initial snapshot is harmless.
    type SnapshotPayload = Awaited<ReturnType<typeof createInitialSnapshot>>;
    const SNAPSHOT_TTL_MS = 1000;
    let snapshotCache: { at: number; payload: SnapshotPayload } | null = null;
    let snapshotInFlight: Promise<SnapshotPayload> | null = null;
    const getSnapshot = (): Promise<SnapshotPayload> => {
        if (snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
            return Promise.resolve(snapshotCache.payload);
        }
        if (snapshotInFlight) return snapshotInFlight;
        snapshotInFlight = createInitialSnapshot(taskSnapshots)
            .then((payload) => {
                snapshotCache = { at: Date.now(), payload };
                return payload;
            })
            .finally(() => { snapshotInFlight = null; });
        return snapshotInFlight;
    };
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
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
        void getSnapshot()
            .then((payload) => {
                // The client may have given up during the (possibly slow) build.
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
        close: async () => {
            clearInterval(heartbeat);
            await nestApp.close();
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
