import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller.js";
import { BookmarkController } from "./controllers/bookmark.controller.js";
import { SearchController } from "./controllers/search.controller.js";
import { EvaluationController } from "./controllers/evaluation.controller.js";
import {
    IngestController,
    EventController,
    LifecycleController,
    BookmarkWriteController,
    EvaluationWriteController,
    registerWriteControllerMetadata,
} from "@monitor/adapter-http-ingest";
import { MonitorService, type MonitorPorts } from "@monitor/application";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database/database.provider.js";
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
        const serviceProvider: Provider = {
            provide: MonitorService,
            useFactory: (ports: MonitorPorts) => new MonitorService(ports),
            inject: [MONITOR_PORTS_TOKEN]
        };
        setParamTypes(AdminController, MonitorService);
        setParamTypes(BookmarkController, MonitorService);
        setParamTypes(SearchController, MonitorService);
        setParamTypes(EvaluationController, MonitorService);
        registerWriteControllerMetadata(MonitorService);
        return {
            module: AppModule,
            imports: [],
            providers: [
                dbProvider,
                serviceProvider
            ],
            controllers: [
                AdminController,
                BookmarkController,
                SearchController,
                EvaluationController,
                IngestController,
                EventController,
                LifecycleController,
                BookmarkWriteController,
                EvaluationWriteController
            ],
            exports: [MONITOR_PORTS_TOKEN, MonitorService]
        };
    }
}
