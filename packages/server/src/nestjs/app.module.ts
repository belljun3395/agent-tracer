/**
 * @module nestjs/app.module
 *
 * NestJS 루트 모듈 — 데이터베이스, 서비스, 컨트롤러를 조합한다.
 *
 * 의존성 주입 전략:
 * - emitDecoratorMetadata 없이 동작하도록 useFactory + inject 배열 패턴을 사용한다.
 * - 컨트롤러도 useValue/useFactory로 미리 생성된 인스턴스를 등록한다.
 * - NestJS가 컨트롤러 인스턴스를 생성할 때 DI 컨테이너에서 이미 생성된 인스턴스를 반환하도록
 *   Reflect.metadata('design:paramtypes', []) 를 명시적으로 설정한다.
 */
import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller.js";
import { LifecycleController } from "./controllers/lifecycle.controller.js";
import { EventController } from "./controllers/event.controller.js";
import { BookmarkController } from "./controllers/bookmark.controller.js";
import { SearchController } from "./controllers/search.controller.js";
import { EvaluationController } from "./controllers/evaluation.controller.js";
import { MonitorServiceProvider } from "./service/monitor-service.provider.js";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database/database.provider.js";
import type { MonitorPorts } from "../application/ports/index.js";

export interface AppModuleOptions {
  readonly databasePath: string;
  readonly notifier?: MonitorPorts["notifier"];
}

/**
 * Sets constructor parameter type metadata so NestJS DI can inject dependencies
 * without emitDecoratorMetadata (esbuild / tsx environments).
 */
function setParamTypes(target: new (...args: unknown[]) => unknown, ...types: unknown[]) {
  Reflect.defineMetadata("design:paramtypes", types, target);
}

@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    const dbProvider = DatabaseProvider(options);

    // Explicitly declare constructor param types so NestJS DI works without emitDecoratorMetadata
    setParamTypes(MonitorServiceProvider, Object);

    const serviceProvider: Provider = {
      provide: MonitorServiceProvider,
      useFactory: (ports: MonitorPorts) => new MonitorServiceProvider(ports),
      inject: [MONITOR_PORTS_TOKEN]
    };

    // Tell NestJS DI that each controller expects MonitorServiceProvider as first param
    setParamTypes(AdminController, MonitorServiceProvider);
    setParamTypes(LifecycleController, MonitorServiceProvider);
    setParamTypes(EventController, MonitorServiceProvider);
    setParamTypes(BookmarkController, MonitorServiceProvider);
    setParamTypes(SearchController, MonitorServiceProvider);
    setParamTypes(EvaluationController, MonitorServiceProvider);

    return {
      module: AppModule,
      imports: [],
      providers: [
        dbProvider,
        serviceProvider
      ],
      controllers: [
        AdminController,
        LifecycleController,
        EventController,
        BookmarkController,
        SearchController,
        EvaluationController
      ],
      exports: [MONITOR_PORTS_TOKEN, MonitorServiceProvider]
    };
  }
}
