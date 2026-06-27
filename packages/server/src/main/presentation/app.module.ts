import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import type { INotificationPublisher } from "@monitor/contracts/notifications/notification.publisher.port.js";
import { AppConfigModule } from "~config/app-config.module.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { LlmModule } from "~adapters/llm/llm.module.js";
import { ActivityModule } from "@monitor/activity/activity.module.js";
import { GovernanceModule } from "~governance/governance.module.js";
import { WorkModule } from "@monitor/work/work.module.js";
import { IdentityModule } from "~identity/identity.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { TypeOrmDatabaseModule } from "./database/typeorm.database.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { ApiResponseInterceptor } from "./interceptors/api-response.interceptor.js";
import { RequestContextMiddleware } from "./middleware/request-context.middleware.js";
import { UserContextMiddleware } from "./middleware/user-context.middleware.js";

export interface AppModuleOptions {
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(UserContextMiddleware, RequestContextMiddleware).forRoutes("*");
    }

    static forRoot(options: AppModuleOptions): DynamicModule {
        const databaseModule = DatabaseModule.forRoot(options);
        const typeOrmDatabaseModule = TypeOrmDatabaseModule.forRoot();
        const governanceModule = GovernanceModule.register(databaseModule);
        const activityModule = ActivityModule.register(databaseModule, governanceModule);
        const workModule = WorkModule.register(databaseModule);

        return {
            module: AppModule,
            imports: [
                AppConfigModule,
                ScheduleModule.forRoot(),
                typeOrmDatabaseModule,
                databaseModule,
                LlmModule,
                IdentityModule,
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
            ],
        };
    }
}
