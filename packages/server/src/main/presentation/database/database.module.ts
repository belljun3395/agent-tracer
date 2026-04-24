import { Module, type DynamicModule } from "@nestjs/common";
import type { INotificationPublisher } from "~application/index.js";
import {
    DATABASE_PORT_TOKENS,
    DatabaseProviders,
    EMBEDDING_SERVICE_TOKEN,
    SQLITE_DATABASE_CONTEXT_TOKEN,
} from "./database.provider.js";

export interface DatabaseModuleOptions {
    readonly databasePath: string;
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class DatabaseModule {
    static forRoot(options: DatabaseModuleOptions): DynamicModule {
        return {
            module: DatabaseModule,
            providers: DatabaseProviders(options),
            exports: [
                SQLITE_DATABASE_CONTEXT_TOKEN,
                EMBEDDING_SERVICE_TOKEN,
                ...DATABASE_PORT_TOKENS,
            ],
        };
    }
}
