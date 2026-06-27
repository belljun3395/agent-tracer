import type http from "node:http";
import type express from "express";
import type { WebSocketServer } from "ws";

export interface MonitorRuntime {
    readonly app: ReturnType<typeof express>;
    readonly server: http.Server;
    readonly wss: WebSocketServer;
    /** Listen address + resolved paths, sourced from the DI-managed config. */
    readonly listen: {
        readonly host: string;
        readonly port: number;
        readonly publicBaseUrl: string;
        readonly database: string;
    };
    readonly close: () => Promise<void>;
}
