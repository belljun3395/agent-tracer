import "reflect-metadata";
import type http from "node:http";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import { loadApplicationConfig, resolveMonitorDatabasePath, resolveMonitorHttpBaseUrl, resolveMonitorListenHost, resolveMonitorPort } from "../../../../../config/load-application-config.js";
import { AppModule } from "./app.module.js";
import { EventBroadcaster } from "../ws/event-broadcaster.js";
import { MonitorServiceProvider } from "./service/monitor-service.provider.js";
import { MONITOR_PORTS_TOKEN, type PortsWithClose } from "./database/database.provider.js";
async function bootstrap() {
    const applicationConfig = loadApplicationConfig();
    const databasePath = resolveMonitorDatabasePath(applicationConfig, { cwd: process.cwd(), env: process.env });
    const port = resolveMonitorPort(applicationConfig, process.env);
    const listenHost = resolveMonitorListenHost(applicationConfig, process.env);
    const publicBaseUrl = resolveMonitorHttpBaseUrl(applicationConfig, process.env);
    const broadcaster = new EventBroadcaster();
    const nestApp = await NestFactory.create(AppModule.forRoot({ databasePath, notifier: broadcaster }), { logger: ["error", "warn"] });
    const httpServer: http.Server = nestApp.getHttpServer() as http.Server;
    const wss = new WebSocketServer({ noServer: true });
    httpServer.on("upgrade", (request, socket, head) => {
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
    const service = nestApp.get(MonitorServiceProvider);
    wss.on("connection", (ws) => {
        broadcaster.addClient(ws);
        ws.on("close", () => broadcaster.removeClient(ws));
        void Promise.all([service.getOverview(), service.listTasks()]).then(([stats, tasks]) => {
            ws.send(JSON.stringify({ type: "snapshot", payload: { stats, tasks } }));
        });
    });
    await nestApp.listen(port, listenHost);
    console.log(`[nestjs-server] listening on ${publicBaseUrl}`);
    console.log(`[nestjs-server] database: ${databasePath}`);
    process.on("SIGTERM", () => {
        wss.close();
        const ports = nestApp.get<PortsWithClose>(MONITOR_PORTS_TOKEN);
        ports.close();
        void nestApp.close().then(() => { process.exit(0); });
    });
}
bootstrap().catch(console.error);
