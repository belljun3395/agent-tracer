import type { OnApplicationShutdown} from "@nestjs/common";
import { Injectable, type Provider } from "@nestjs/common";
import { registerDefaultRuntimeAdapters } from "@monitor/domain";
import { createSqliteMonitorPorts } from "@monitor/adapter-sqlite";
import type { MonitorPorts } from "@monitor/application";
import { createEmbeddingService } from "@monitor/adapter-embedding";
export const MONITOR_PORTS_TOKEN = "MONITOR_PORTS";
export interface PortsWithClose extends MonitorPorts {
    close(): void;
}
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
    constructor(private readonly ports: PortsWithClose) { }
    onApplicationShutdown() {
        this.ports.close();
    }
}
export function DatabaseProvider(options: {
    databasePath: string;
    notifier?: MonitorPorts["notifier"];
}): Provider {
    return {
        provide: MONITOR_PORTS_TOKEN,
        useFactory: (): PortsWithClose => {
            registerDefaultRuntimeAdapters();
            const embeddingService = createEmbeddingService();
            return createSqliteMonitorPorts({
                databasePath: options.databasePath,
                ...(options.notifier ? { notifier: options.notifier } : {}),
                ...(embeddingService ? { embeddingService } : {})
            });
        }
    };
}
