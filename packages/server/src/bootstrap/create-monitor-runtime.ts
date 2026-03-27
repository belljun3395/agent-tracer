/**
 * @module bootstrap/create-monitor-runtime
 *
 * 유일한 조합 루트. SQLite 저장소, EventBroadcaster, MonitorService, Express 앱을
 * 하나의 런타임으로 조합한다.
 */
import http from "node:http";

import type express from "express";
import { WebSocketServer } from "ws";

import { MonitorService } from "../application/monitor-service.js";
import { createSqliteMonitorPorts } from "../infrastructure/sqlite/index.js";
import { createEmbeddingService } from "../infrastructure/embedding/index.js";
import { createApp } from "../presentation/create-app.js";
import { EventBroadcaster } from "../presentation/ws/event-broadcaster.js";

export interface RuntimeOptions {
  readonly databasePath: string;
}

export interface MonitorRuntime {
  readonly service: MonitorService;
  readonly app: ReturnType<typeof express>;
  readonly server: http.Server;
  readonly wss: WebSocketServer;
  readonly close: () => void;
}

export function createMonitorRuntime(options: RuntimeOptions): MonitorRuntime {
  const broadcaster = new EventBroadcaster();
  const embeddingService = createEmbeddingService();
  const ports = createSqliteMonitorPorts({
    ...options,
    notifier: broadcaster,
    ...(embeddingService ? { embeddingService } : {}),
  });
  const service = new MonitorService(ports);
  const app = createApp(service);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    broadcaster.addClient(ws);
    ws.on("close", () => broadcaster.removeClient(ws));
    void Promise.all([service.getOverview(), service.listTasks()]).then(([stats, tasks]) => {
      ws.send(JSON.stringify({ type: "snapshot", payload: { stats, tasks } }));
    });
  });

  return {
    service,
    app,
    server,
    wss,
    close: () => { wss.close(); server.close(); (ports as { close?: () => void }).close?.(); }
  };
}
