import { type Provider } from "@nestjs/common";
import { createSqliteMonitorPorts } from "~adapters/persistence/sqlite/index.js";
import type { MonitorPorts } from "~application/index.js";
import { createEmbeddingService } from "~adapters/ai/embedding/index.js";
export const MONITOR_PORTS_TOKEN = "MONITOR_PORTS";
export interface PortsWithClose extends MonitorPorts {
    close(): void;
}
export function DatabaseProvider(options: {
    databasePath: string;
    notifier?: MonitorPorts["notifier"];
}): Provider {
    return {
        provide: MONITOR_PORTS_TOKEN,
        useFactory: (): PortsWithClose => {
            const embeddingService = createEmbeddingService();
            return createSqliteMonitorPorts({
                databasePath: options.databasePath,
                ...(options.notifier ? { notifier: options.notifier } : {}),
                ...(embeddingService ? { embeddingService } : {})
            });
        }
    };
}
