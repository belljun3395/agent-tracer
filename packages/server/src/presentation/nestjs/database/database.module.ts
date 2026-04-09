/**
 * @module nestjs/database/database.module
 *
 * NestJS 데이터베이스 모듈 — SQLite MonitorPorts 생성 및 수명 주기 관리.
 */
import { Module, type DynamicModule } from "@nestjs/common";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database.provider.js";

export interface DatabaseModuleOptions {
  readonly databasePath: string;
}

@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const provider = DatabaseProvider(options);
    return {
      module: DatabaseModule,
      providers: [provider],
      exports: [MONITOR_PORTS_TOKEN]
    };
  }
}
