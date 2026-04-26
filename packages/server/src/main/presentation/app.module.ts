import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import type { INotificationPublisher } from "~application/index.js";
import { EventsApplicationModule } from "./application/events-application.module.js";
import { RuleCommandsApplicationModule } from "./application/rule-commands-application.module.js";
import { SessionsApplicationModule } from "./application/sessions-application.module.js";
import { SystemApplicationModule } from "./application/system-application.module.js";
import { TasksApplicationModule } from "./application/tasks-application.module.js";
import { TurnPartitionsApplicationModule } from "./application/turn-partitions-application.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { EventsHttpModule } from "./http/events-http.module.js";
import { RuleCommandsHttpModule } from "./http/rule-commands-http.module.js";
import { SessionsHttpModule } from "./http/sessions-http.module.js";
import { SystemHttpModule } from "./http/system-http.module.js";
import { TasksHttpModule } from "./http/tasks-http.module.js";
import { TurnPartitionsHttpModule } from "./http/turn-partitions-http.module.js";
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
        const eventsApplicationModule = EventsApplicationModule.register(databaseModule);
        const ruleCommandsApplicationModule = RuleCommandsApplicationModule.register(databaseModule);
        const tasksApplicationModule = TasksApplicationModule.register(databaseModule);
        const sessionsApplicationModule = SessionsApplicationModule.register(databaseModule, tasksApplicationModule);
        const systemApplicationModule = SystemApplicationModule.register(databaseModule);
        const turnPartitionsApplicationModule = TurnPartitionsApplicationModule.register(databaseModule);

        return {
            module: AppModule,
            imports: [
                databaseModule,
                EventsHttpModule.register(eventsApplicationModule, ruleCommandsApplicationModule),
                RuleCommandsHttpModule.register(ruleCommandsApplicationModule),
                SessionsHttpModule.register(sessionsApplicationModule),
                SystemHttpModule.register(systemApplicationModule),
                TasksHttpModule.register(tasksApplicationModule),
                TurnPartitionsHttpModule.register(turnPartitionsApplicationModule),
            ],
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
