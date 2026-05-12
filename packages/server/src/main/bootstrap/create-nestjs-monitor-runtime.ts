import "reflect-metadata";
import { initializeTransactionalContext } from "typeorm-transactional";
import type http from "node:http";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";

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
    const nestApp = await NestFactory.create(AppModule.forRoot({ databasePath: options.databasePath, notifier }), { logger: ["error", "warn"] });
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    configureTrustedProxy(app);
    const server = nestApp.getHttpServer() as http.Server;
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
        const requestUrl = request.url ?? "/";
        const { pathname } = new URL(requestUrl, "http://localhost");
        const context = createUpgradeRequestContext(request);
        const userAgentHeader = request.headers["user-agent"];
        const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
        assignRequestContext(request as RequestContextIncomingMessage, context);
        logHttpUpgrade({
            type: "http_upgrade",
            requestId: context.requestId,
            path: pathname,
            accepted: pathname === "/ws",
            clientIp: context.clientIp,
            ...(userAgent ? { userAgent } : {}),
        });
        if (pathname === "/ws") {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
            return;
        }
        socket.destroy();
    });
    const taskSnapshots = nestApp.get<ITaskSnapshotQuery>(TASK_SNAPSHOT_QUERY);
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
        ws.on("close", () => broadcaster.removeClient(ws));
        void createInitialSnapshot(taskSnapshots).then((payload) => {
            ws.send(JSON.stringify({ type: "snapshot", payload }));
        });
    });
    await nestApp.init();
    const taskLifecycle = nestApp.get<ITaskLifecycle>(TASK_LIFECYCLE);
    await reapStuckServerSdkTasks(taskSnapshots, taskLifecycle);
    return {
        app,
        server,
        wss,
        close: async () => {
            await nestApp.close();
            await new Promise<void>((resolve) => {
                wss.close(() => resolve());
            });
        }
    };
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
