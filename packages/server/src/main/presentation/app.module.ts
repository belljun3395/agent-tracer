import { Module, type DynamicModule } from "@nestjs/common";
import type { INotificationPublisher } from "~application/index.js";
import { ApplicationModule } from "./application/application.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { IngestHttpModule } from "./http/ingest-http.module.js";
import { QueryHttpModule } from "./http/query-http.module.js";

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
                IngestHttpModule,
                QueryHttpModule,
            ],
        };
    }
}
