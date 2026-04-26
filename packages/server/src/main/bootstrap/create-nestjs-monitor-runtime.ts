import "reflect-metadata";
import type http from "node:http";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import { AppModule } from "../presentation/app.module.js";
import { EventBroadcasterService } from "~adapters/realtime/ws/event.broadcaster.service.js";
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import { tallyTaskStatuses } from "~domain/monitoring/common/task.status.js";
import type { TaskStatus } from "~domain/monitoring/common/type/task.status.type.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";
import {
    SQLITE_DATABASE_CONTEXT_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../presentation/database/database.provider.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import type { RuntimeOptions, MonitorRuntime } from "./runtime.type.js";

interface BootstrapTaskRepository {
    findAll(): Promise<readonly MonitoringTask[]>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;
}

export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
    const broadcaster = new EventBroadcasterService();
    const nestApp = await NestFactory.create(AppModule.forRoot({ databasePath: options.databasePath, notifier: broadcaster }), { logger: false });
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
    const taskRepository = nestApp.get<BootstrapTaskRepository>(TASK_REPOSITORY_TOKEN);
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
        ws.on("close", () => broadcaster.removeClient(ws));
        void createInitialSnapshot(taskRepository).then((payload) => {
            ws.send(JSON.stringify({ type: "snapshot", payload }));
        });
    });
    await nestApp.init();
    const databaseContext = nestApp.get<SqliteDatabaseContext>(SQLITE_DATABASE_CONTEXT_TOKEN);
    return {
        app,
        server,
        wss,
        close: async () => {
            await nestApp.close();
            await new Promise<void>((resolve) => {
                wss.close(() => resolve());
            });
            databaseContext.close();
        }
    };
}

async function createInitialSnapshot(taskRepository: BootstrapTaskRepository): Promise<{
    readonly stats: ReturnType<typeof tallyTaskStatuses> & { readonly totalEvents: number };
    readonly tasks: readonly MonitoringTask[];
}> {
    const [statuses, totalEvents, tasks] = await Promise.all([
        taskRepository.listTaskStatuses(),
        taskRepository.countTimelineEvents(),
        taskRepository.findAll(),
    ]);

    return {
        stats: {
            ...tallyTaskStatuses(statuses),
            totalEvents,
        },
        tasks,
    };
}
