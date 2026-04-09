/**
 * @module nestjs/service/monitor-service.provider
 *
 * MonitorService를 NestJS provider로 노출하는 래퍼 클래스.
 * AppModule에서 useFactory 패턴으로 인스턴스화되므로
 * @Inject 데코레이터나 emitDecoratorMetadata가 필요 없다.
 */
import { Injectable } from "@nestjs/common";
import { MonitorService } from "../../../application/monitor-service.js";
import type { MonitorPorts } from "../../../application/ports";

@Injectable()
export class MonitorServiceProvider extends MonitorService {
  constructor(ports: MonitorPorts) {
    super(ports);
  }
}
