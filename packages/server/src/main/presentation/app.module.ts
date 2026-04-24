import { Module, type DynamicModule } from "@nestjs/common";
import type { INotificationPublisher } from "~application/index.js";
import { ApplicationModule } from "./application/application.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { BookmarksHttpModule } from "./http/bookmarks-http.module.js";
import { EventsHttpModule } from "./http/events-http.module.js";
import { RuleCommandsHttpModule } from "./http/rule-commands-http.module.js";
import { SessionsHttpModule } from "./http/sessions-http.module.js";
import { SystemHttpModule } from "./http/system-http.module.js";
import { TasksHttpModule } from "./http/tasks-http.module.js";
import { TurnPartitionsHttpModule } from "./http/turn-partitions-http.module.js";
import { WorkflowHttpModule } from "./http/workflow-http.module.js";

export interface AppModuleOptions {
    readonly databasePath: string;
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class AppModule {
    static forRoot(options: AppModuleOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                DatabaseModule.forRoot(options),
                ApplicationModule,
                BookmarksHttpModule,
                EventsHttpModule,
                RuleCommandsHttpModule,
                SessionsHttpModule,
                SystemHttpModule,
                TasksHttpModule,
                TurnPartitionsHttpModule,
                WorkflowHttpModule,
            ],
        };
    }
}
