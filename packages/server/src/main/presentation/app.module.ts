import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { ActivityModule } from "~activity/activity.module.js";
import { GovernanceModule } from "~governance/governance.module.js";
import { WorkModule } from "~work/work.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { TypeOrmDatabaseModule } from "./database/typeorm.database.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { ApiResponseInterceptor } from "./interceptors/api-response.interceptor.js";
import { RequestContextMiddleware } from "./middleware/request-context.middleware.js";
import { IngestMetricsInterceptor } from "~main/observability/ingest.metrics.interceptor.js";

export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestContextMiddleware).forRoutes("*");
    }

    static forRoot(options: AppModuleOptions): DynamicModule {
        const databaseModule = DatabaseModule.forRoot(options);
        const typeOrmDatabaseModule = TypeOrmDatabaseModule.forRoot({ databasePath: options.databasePath });
        const governanceModule = GovernanceModule.register(databaseModule);
        const activityModule = ActivityModule.register(databaseModule, governanceModule);
        const workModule = WorkModule.register(databaseModule);

        return {
            module: AppModule,
            imports: [
                typeOrmDatabaseModule,
                databaseModule,
                governanceModule,
                activityModule,
                workModule,
            ],
            controllers: [HealthController],
            providers: [
                {
                    provide: APP_FILTER,
                    useClass: GlobalExceptionFilter,
                },
                {
                    provide: APP_INTERCEPTOR,
                    useClass: ApiResponseInterceptor,
                },
                {
                    provide: APP_INTERCEPTOR,
                    useClass: IngestMetricsInterceptor,
                },
            ],
        };
    }
}
