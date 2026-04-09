/**
 * @module bootstrap/create-nestjs-monitor-runtime
 *
 * NestJS 기반 런타임 팩토리.
 * Express 기반 createMonitorRuntime과 동일한 MonitorRuntime 인터페이스를 반환하여
 * 기존 index.ts의 서버 시작 코드를 수정 없이 재사용할 수 있다.
 */
import "reflect-metadata";
import http from "node:http";
import type express from "express";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";

import { AppModule } from "../nestjs/app.module.js";
import { EventBroadcaster } from "../presentation/ws/event-broadcaster.js";
import { GlobalExceptionFilter } from "../nestjs/filters/zod-exception.filter.js";
import { MonitorServiceProvider } from "../nestjs/service/monitor-service.provider.js";
import { MonitorService } from "../application/monitor-service.js";
import { MONITOR_PORTS_TOKEN, type PortsWithClose } from "../nestjs/database/database.provider.js";
import type { RuntimeOptions, MonitorRuntime } from "./create-monitor-runtime.js";

/**
 * NestJS 기반 MonitorRuntime을 생성한다.
 * MonitorRuntime.app은 NestJS HTTP adapter를 통해 얻은 express 인스턴스다.
 */
export async function createNestMonitorRuntime(options: RuntimeOptions): Promise<MonitorRuntime> {
  const broadcaster = new EventBroadcaster();

  const nestApp = await NestFactory.create(
    AppModule.forRoot({ databasePath: options.databasePath, notifier: broadcaster }),
    { logger: false }
  );
  nestApp.useGlobalFilters(new GlobalExceptionFilter());

  // NestJS는 기본적으로 express adapter를 사용하므로 getHttpServer()가 http.Server를 반환한다.
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

  const service = nestApp.get(MonitorServiceProvider) as MonitorService;

  wss.on("connection", (ws) => {
    broadcaster.addClient(ws);
    ws.on("close", () => broadcaster.removeClient(ws));
    void Promise.all([service.getOverview(), service.listTasks()]).then(([stats, tasks]) => {
      ws.send(JSON.stringify({ type: "snapshot", payload: { stats, tasks } }));
    });
  });

  // NestJS를 초기화한다 (미들웨어/파이프 등 등록 완료).
  await nestApp.init();

  const ports = nestApp.get<PortsWithClose>(MONITOR_PORTS_TOKEN);

  // app 필드는 MonitorRuntime 인터페이스 호환을 위해 노출하지만
  // NestJS 앱에서는 직접 사용하지 않는다.
  const app = nestApp.getHttpAdapter().getInstance() as ReturnType<typeof express>;

  return {
    service: service as MonitorService,
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
