import { Module, type DynamicModule, type ExecutionContext, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { AppConfigModule } from "~config/app-config.module.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { EventModule } from "@monitor/timeline-api/event/event.module.js";
import { SessionModule } from "@monitor/run-api/session/session.module.js";
import { TaskModule } from "@monitor/run-api/task/task.module.js";
import { VerificationModule } from "@monitor/rules-api/verification/verification.module.js";
import { RuleModule } from "@monitor/rules-api/rule/rule.module.js";
import { SettingsModule } from "@monitor/identity-api/settings/settings.module.js";
import { RuleBackfillModule } from "@monitor/rules-api/rule-backfill/rule.backfill.module.js";
import { RuleGenerationModule } from "@monitor/rules-api/rule-generation/rule.generation.module.js";
import { TaskCleanupModule } from "@monitor/insight-api/task-cleanup/task.cleanup.module.js";
import { RecipeModule } from "@monitor/insight-api/recipe/recipe.module.js";
import { IdentityModule } from "@monitor/identity-api/identity.module.js";
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

        // 순환 의존은 이미 만든 동적 모듈끼리 import를 연결해 forwardRef 없이 해소한다.
        const event = EventModule.register(databaseModule);
        const session = SessionModule.register(databaseModule);
        const task = TaskModule.register(databaseModule);
        const verification = VerificationModule.register(databaseModule);
        const rule = RuleModule.register(databaseModule);
        const settings = SettingsModule.register(databaseModule);
        const ruleBackfill = RuleBackfillModule.register(databaseModule);
        const ruleGeneration = RuleGenerationModule.register(databaseModule);
        const taskCleanup = TaskCleanupModule.register(databaseModule);
        const recipe = RecipeModule.register(databaseModule);

        event.imports!.push(task, verification);
        session.imports!.push(task);
        task.imports!.push(event, session, settings, verification);
        verification.imports!.push(event, rule);
        rule.imports!.push(verification);
        ruleBackfill.imports!.push(rule, verification);
        ruleGeneration.imports!.push(rule, settings, task);
        taskCleanup.imports!.push(settings, task);
        recipe.imports!.push(settings, task);

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
                event,
                session,
                task,
                verification,
                rule,
                settings,
                ruleBackfill,
                ruleGeneration,
                taskCleanup,
                recipe,
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
