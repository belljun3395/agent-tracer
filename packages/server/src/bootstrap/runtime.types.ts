import type http from "node:http";
import type express from "express";
import type { WebSocketServer } from "ws";
import type { MonitorService } from "@monitor/application";

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
