import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import type { INotificationPublisher } from "~application/index.js";
import { ConfigApplicationModule } from "./application/config-application.module.js";
import { EventsApplicationModule } from "./application/events-application.module.js";
import { RulesApplicationModule } from "./application/rules-application.module.js";
import { SessionsApplicationModule } from "./application/sessions-application.module.js";
import { SystemApplicationModule } from "./application/system-application.module.js";
import { TasksApplicationModule } from "./application/tasks-application.module.js";
import { TurnPartitionsApplicationModule } from "./application/turn-partitions-application.module.js";
import { TurnsApplicationModule } from "./application/turns-application.module.js";
import { VerificationApplicationModule } from "./application/verification-application.module.js";
import { WorkflowApplicationModule } from "./application/workflow-application.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { GlobalExceptionFilter } from "./filters/zod-exception.filter.js";
import { ConfigHttpModule } from "./http/config-http.module.js";
import { EventsHttpModule } from "./http/events-http.module.js";
import { SessionsHttpModule } from "./http/sessions-http.module.js";
import { SystemHttpModule } from "./http/system-http.module.js";
import { TasksHttpModule } from "./http/tasks-http.module.js";
import { TurnPartitionsHttpModule } from "./http/turn-partitions-http.module.js";
import { TurnsHttpModule } from "./http/turns-http.module.js";
import { VerificationHttpModule } from "./http/verification-http.module.js";
import { WorkflowHttpModule } from "./http/workflow-http.module.js";
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
        const configApplicationModule = ConfigApplicationModule.register(databaseModule);
        const configHttpModule = ConfigHttpModule.register(configApplicationModule);
        const eventsApplicationModule = EventsApplicationModule.register(databaseModule);
        const verificationApplicationModule = VerificationApplicationModule.register(databaseModule);
        const rulesApplicationModule = RulesApplicationModule.register(databaseModule, verificationApplicationModule);
        const tasksApplicationModule = TasksApplicationModule.register(databaseModule);
        const sessionsApplicationModule = SessionsApplicationModule.register(databaseModule, tasksApplicationModule);
        const systemApplicationModule = SystemApplicationModule.register(databaseModule);
        const turnPartitionsApplicationModule = TurnPartitionsApplicationModule.register(databaseModule);
        const turnsApplicationModule = TurnsApplicationModule.register(databaseModule);
        const workflowApplicationModule = WorkflowApplicationModule.register(databaseModule);

        return {
            module: AppModule,
            imports: [
                databaseModule,
                configApplicationModule,
                verificationApplicationModule,
                configHttpModule,
                EventsHttpModule.register(eventsApplicationModule, rulesApplicationModule),
                SessionsHttpModule.register(sessionsApplicationModule),
                SystemHttpModule.register(systemApplicationModule),
                TasksHttpModule.register(tasksApplicationModule),
                TurnPartitionsHttpModule.register(turnPartitionsApplicationModule),
                TurnsHttpModule.register(turnsApplicationModule),
                VerificationHttpModule.register(rulesApplicationModule, verificationApplicationModule),
                WorkflowHttpModule.register(workflowApplicationModule),
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
