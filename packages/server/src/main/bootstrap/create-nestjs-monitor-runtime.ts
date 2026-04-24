import "reflect-metadata";
import type http from "node:http";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import { AppModule } from "../presentation/app.module.js";
import { EventBroadcasterService } from "~adapters/realtime/ws/index.js";
import { GlobalExceptionFilter } from "../presentation/filters/zod-exception.filter.js";
import {
    assignRequestContext,
    configureTrustedProxy,
    createUpgradeRequestContext,
    logHttpUpgrade,
    type RequestContextIncomingMessage,
} from "../presentation/middleware/request-context.js";
import { GetOverviewUseCase, ListTasksUseCase } from "~application/index.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "../presentation/database/database.provider.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/index.js";
import type { RuntimeOptions, MonitorRuntime } from "./runtime.type.js";
export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
    const broadcaster = new EventBroadcasterService();
    const nestApp = await NestFactory.create(AppModule.forRoot({ databasePath: options.databasePath, notifier: broadcaster }), { logger: false });
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    configureTrustedProxy(app);
    nestApp.useGlobalFilters(new GlobalExceptionFilter());
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
    const getOverview = nestApp.get(GetOverviewUseCase);
    const listTasks = nestApp.get(ListTasksUseCase);
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
        ws.on("close", () => broadcaster.removeClient(ws));
        void Promise.all([getOverview.execute(), listTasks.execute()]).then(([stats, tasks]) => {
            ws.send(JSON.stringify({ type: "snapshot", payload: { stats, tasks } }));
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
