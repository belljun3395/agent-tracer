import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { HealthController } from "~adapters/http/query/controllers/health/health.query.controller.js";
import { EventModule } from "~event/event.module.js";
import { RuleModule } from "~rule/rule.module.js";
import { SessionModule } from "~session/session.module.js";
import { TaskModule } from "~task/task.module.js";
import { TurnPartitionModule } from "~turn-partition/turn.partition.module.js";
import { VerificationModule } from "~verification/verification.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { TypeOrmDatabaseModule } from "./database/typeorm.database.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { ApiResponseInterceptor } from "./interceptors/api-response.interceptor.js";
import { RequestContextMiddleware } from "./middleware/request-context.middleware.js";

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
        const verificationModule = VerificationModule.register(databaseModule);
        const sessionModule = SessionModule.register(databaseModule);
        const taskModule = TaskModule.register(databaseModule);
        const eventModule = EventModule.register(databaseModule, verificationModule);
        const ruleModule = RuleModule.register(databaseModule, verificationModule);
        const turnPartitionModule = TurnPartitionModule.register(databaseModule);

        return {
            module: AppModule,
            imports: [
                typeOrmDatabaseModule,
                databaseModule,
                verificationModule,
                sessionModule,
                taskModule,
                eventModule,
                ruleModule,
                turnPartitionModule,
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
