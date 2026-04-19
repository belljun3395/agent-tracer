import type http from "node:http";
import type express from "express";
import type { WebSocketServer } from "ws";

export interface RuntimeOptions {
    readonly databasePath: string;
}

export interface MonitorRuntime {
    readonly app: ReturnType<typeof express>;
    readonly server: http.Server;
    readonly wss: WebSocketServer;
    readonly close: () => Promise<void>;
}
