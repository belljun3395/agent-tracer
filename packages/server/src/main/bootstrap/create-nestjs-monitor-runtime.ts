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
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import { tallyTaskStatuses } from "~work/task/public/helpers.js";
import type { ITaskSnapshotQuery } from "~work/task/public/iservice/task.snapshot.query.iservice.js";
import type { TaskSnapshot } from "~work/task/public/dto/task.snapshot.dto.js";
import { TASK_SNAPSHOT_QUERY } from "~work/task/public/tokens.js";
import type { RuntimeOptions, MonitorRuntime } from "./runtime.type.js";

export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
    const broadcaster = new EventBroadcasterService();
    const notifier = new LocalNotificationPublisher(broadcaster);
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
