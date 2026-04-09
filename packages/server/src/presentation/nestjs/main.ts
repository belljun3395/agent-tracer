/**
 * @module nestjs/main
 *
 * NestJS 독립 실행 진입점 — 개발/테스트 목적.
 * 프로덕션 진입점은 bootstrap/create-monitor-runtime.ts 에서
 * createNestMonitorRuntime()를 호출한다.
 */
import "reflect-metadata";
import path from "node:path";
import type http from "node:http";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import { AppModule } from "./app.module.js";
import { EventBroadcaster } from "../ws/event-broadcaster.js";
import { MonitorServiceProvider } from "./service/monitor-service.provider.js";
import { MONITOR_PORTS_TOKEN, type PortsWithClose } from "./database/database.provider.js";

async function bootstrap() {
  const databasePath = path.resolve(process.cwd(), ".monitor", "monitor.sqlite");
  const broadcaster = new EventBroadcaster();

  const nestApp = await NestFactory.create(
    AppModule.forRoot({ databasePath, notifier: broadcaster }),
    { logger: ["error", "warn"] }
  );

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

  const port = Number(process.env.MONITOR_PORT ?? 3847);
  await nestApp.listen(port);
  console.log(`[nestjs-server] listening on http://127.0.0.1:${port}`);
  console.log(`[nestjs-server] database: ${databasePath}`);

  process.on("SIGTERM", () => {
    wss.close();
    const ports = nestApp.get<PortsWithClose>(MONITOR_PORTS_TOKEN);
    ports.close();
    void nestApp.close().then(() => { process.exit(0); });
  });
}

bootstrap().catch(console.error);
