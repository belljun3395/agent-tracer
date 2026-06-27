import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { AppConfigModule } from "~config/app-config.module.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { EventModule } from "@monitor/activity-api/event/event.module.js";
import { SessionModule } from "@monitor/activity-api/session/session.module.js";
import { TaskModule } from "@monitor/work-api/task/task.module.js";
import { TurnModule } from "@monitor/work-api/turn/turn.module.js";
import { VerificationModule } from "@monitor/governance-api/verification/verification.module.js";
import { RuleModule } from "@monitor/governance-api/rule/rule.module.js";
import { SettingsModule } from "@monitor/governance-api/settings/settings.module.js";
import { RuleBackfillModule } from "@monitor/governance-api/rule-backfill/rule.backfill.module.js";
import { RuleGenerationModule } from "@monitor/governance-api/rule-generation/rule.generation.module.js";
import { TaskCleanupModule } from "@monitor/governance-api/task-cleanup/task.cleanup.module.js";
import { RecipeModule } from "@monitor/governance-api/recipe/recipe.module.js";
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

        // 각 바운디드 컨텍스트 모듈을 인스턴스로 만든 뒤, 토큰을 주입받는 쪽이
        // 제공하는 쪽을 명시적으로 import 하도록 의존을 연결한다. 이미 생성된
        // 인스턴스끼리 연결하므로 모듈 간 순환(event↔task, event↔verification,
        // verification↔rule, task↔session)도 forwardRef 없이 해소된다.
        const event = EventModule.register(databaseModule);
        const session = SessionModule.register(databaseModule);
        const task = TaskModule.register(databaseModule);
        const turn = TurnModule.register(databaseModule);
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
        turn.imports!.push(event, task);
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
                typeOrmDatabaseModule,
                databaseModule,
                IdentityModule,
                event,
                session,
                task,
                turn,
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
            ],
        };
    }
}
