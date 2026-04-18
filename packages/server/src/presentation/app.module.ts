import { Module, type DynamicModule, type Provider } from "@nestjs/common";
import {
    IngestController,
    EventController,
    LifecycleController,
    BookmarkWriteController,
    EvaluationWriteController,
    registerWriteControllerMetadata,
} from "@monitor/adapter-http-ingest";
import {
    OtlpLogsController,
    registerOtlpControllerMetadata,
} from "@monitor/adapter-otlp-logs";
import {
    AdminController,
    BookmarkController,
    EvaluationController,
    SearchController,
    registerQueryControllerMetadata,
} from "@monitor/adapter-http-query";
import { MonitorService, type MonitorPorts } from "@monitor/application";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database/database.provider.js";
export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: MonitorPorts["notifier"];
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
        registerWriteControllerMetadata(MonitorService);
        registerQueryControllerMetadata(MonitorService);
        registerOtlpControllerMetadata(MonitorService);
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
                EvaluationWriteController,
                OtlpLogsController,
            ],
            exports: [MONITOR_PORTS_TOKEN, MonitorService]
        };
    }
}
