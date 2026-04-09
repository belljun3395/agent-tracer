/**
 * @module nestjs/service/service.module
 *
 * MonitorService를 NestJS provider로 등록하는 모듈.
 */
import { Module } from "@nestjs/common";
import { MonitorServiceProvider } from "./monitor-service.provider.js";
import { DatabaseModule } from "../database/database.module.js";

@Module({
  imports: [DatabaseModule],
  providers: [MonitorServiceProvider],
  exports: [MonitorServiceProvider]
})
export class ServiceModule {}
