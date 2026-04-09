import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller.js";
import { LifecycleController } from "./controllers/lifecycle.controller.js";
import { EventController } from "./controllers/event.controller.js";
import { BookmarkController } from "./controllers/bookmark.controller.js";
import { SearchController } from "./controllers/search.controller.js";
import { EvaluationController } from "./controllers/evaluation.controller.js";
import { MonitorServiceProvider } from "./service/monitor-service.provider.js";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database/database.provider.js";
import type { MonitorPorts } from "../../application/ports";
export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: MonitorPorts["notifier"];
}
function setParamTypes(target: object, ...types: unknown[]) {
    Reflect.defineMetadata("design:paramtypes", types, target);
}
@Module({})
export class AppModule {
    static forRoot(options: AppModuleOptions): DynamicModule {
        const dbProvider = DatabaseProvider(options);
        setParamTypes(MonitorServiceProvider, Object);
        const serviceProvider: Provider = {
            provide: MonitorServiceProvider,
            useFactory: (ports: MonitorPorts) => new MonitorServiceProvider(ports),
            inject: [MONITOR_PORTS_TOKEN]
        };
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
