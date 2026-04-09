/**
 * @module nestjs/database/database.provider
 *
 * SQLite MonitorPorts를 NestJS Provider로 노출한다.
 * OnApplicationShutdown 훅으로 앱 종료 시 DB를 닫는다.
 */
import { Injectable, OnApplicationShutdown, type Provider } from "@nestjs/common";
import { initializeDefaultAdapters } from "@monitor/core";
import { createSqliteMonitorPorts } from "../../../infrastructure/sqlite";
import type { MonitorPorts } from "../../../application/ports";
import { createEmbeddingService } from "../../../infrastructure/embedding";

export const MONITOR_PORTS_TOKEN = "MONITOR_PORTS";

export interface PortsWithClose extends MonitorPorts {
  close(): void;
}

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(private readonly ports: PortsWithClose) {}

  onApplicationShutdown() {
    this.ports.close();
  }
}

export function DatabaseProvider(options: { databasePath: string; notifier?: MonitorPorts["notifier"] }): Provider {
  return {
    provide: MONITOR_PORTS_TOKEN,
    useFactory: (): PortsWithClose => {
      initializeDefaultAdapters();
      const embeddingService = createEmbeddingService();
      return createSqliteMonitorPorts({
        databasePath: options.databasePath,
        ...(options.notifier ? { notifier: options.notifier } : {}),
        ...(embeddingService ? { embeddingService } : {})
      });
    }
  };
}
