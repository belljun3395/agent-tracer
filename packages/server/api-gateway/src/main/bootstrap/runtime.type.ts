import type http from "node:http";

export interface MonitorRuntime {
    readonly server: http.Server;

    readonly listen: {
        readonly host: string;
        readonly port: number;
        readonly publicBaseUrl: string;
        readonly database: string;
    };
    readonly close: () => Promise<void>;
}
