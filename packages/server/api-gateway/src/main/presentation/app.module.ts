import { Module, type DynamicModule, type ExecutionContext, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppConfigModule } from "@monitor/server-core/config/app-config.module.js";
import { DatabaseModule } from "@monitor/server-core/database/database.module.js";
import { TypeOrmDatabaseModule } from "@monitor/server-core/database/typeorm.database.module.js";
import { buildFeatureModules } from "@monitor/server-core/feature-modules.js";
import type { ServerModuleOptions } from "@monitor/server-core/server-module-options.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { IdentityModule } from "@monitor/identity-api/identity.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { ApiResponseInterceptor } from "./interceptors/api-response.interceptor.js";
import { RequestContextMiddleware } from "./middleware/request-context.middleware.js";
import { UserContextMiddleware } from "./middleware/user-context.middleware.js";

@Module({})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(UserContextMiddleware, RequestContextMiddleware).forRoutes("*");
    }

    static forRoot(options: ServerModuleOptions): DynamicModule {
        const databaseModule = DatabaseModule.forRoot(options);
        const typeOrmDatabaseModule = TypeOrmDatabaseModule.forRoot();

        return {
            module: AppModule,
            imports: [
                AppConfigModule,
                ScheduleModule.forRoot(),
                EventEmitterModule.forRoot(),

                // ingest 요청은 런타임 이벤트 스트림이므로 일반 API 요청 제한에서 제외한다.
                ThrottlerModule.forRoot({
                    throttlers: [{ ttl: 60_000, limit: 300 }],
                    skipIf: (context: ExecutionContext) => {
                        const request = context.switchToHttp().getRequest<{ url?: string }>();
                        return typeof request.url === "string" && request.url.startsWith("/ingest/");
                    },
                }),
                typeOrmDatabaseModule,
                databaseModule,
                IdentityModule,
                ...buildFeatureModules(databaseModule),
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
                    provide: APP_GUARD,
                    useClass: ThrottlerGuard,
                },
            ],
        };
    }
}
