import "reflect-metadata";
import type http from "node:http";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import { AppModule } from "../presentation/app.module.js";
import { EventBroadcaster } from "../presentation/ws/event-broadcaster.js";
import { GlobalExceptionFilter } from "../presentation/filters/zod-exception.filter.js";
import { MonitorService } from "@monitor/application";
import { MONITOR_PORTS_TOKEN, type PortsWithClose } from "../presentation/database/database.provider.js";
import type { RuntimeOptions, MonitorRuntime } from "./runtime.types.js";
export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
    const broadcaster = new EventBroadcaster();
    const nestApp = await NestFactory.create(AppModule.forRoot({ databasePath: options.databasePath, notifier: broadcaster }), { logger: false });
    nestApp.useGlobalFilters(new GlobalExceptionFilter());
    const server = nestApp.getHttpServer() as http.Server;
    const wss = new WebSocketServer({ noServer: true });
    server.on("upgrade", (request, socket, head) => {
        const requestUrl = request.url ?? "/";
        const { pathname } = new URL(requestUrl, "http://localhost");
        if (pathname === "/ws") {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit("connection", ws, request);
            });
            return;
        }
        socket.destroy();
    });
    const service = nestApp.get(MonitorService);
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
        ws.on("close", () => broadcaster.removeClient(ws));
        void Promise.all([service.getOverview(), service.listTasks()]).then(([stats, tasks]) => {
            ws.send(JSON.stringify({ type: "snapshot", payload: { stats, tasks } }));
        });
    });
    await nestApp.init();
    const ports = nestApp.get<PortsWithClose>(MONITOR_PORTS_TOKEN);
    const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;
    return {
        service,
        app,
        server,
        wss,
        close: () => {
            wss.close();
            server.close();
            ports.close();
            void nestApp.close();
        }
    };
}
