import { Module, type DynamicModule } from "@nestjs/common";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import {
    DatabaseProviders,
    NOTIFICATION_PUBLISHER_TOKEN,
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
            exports: [NOTIFICATION_PUBLISHER_TOKEN],
        };
    }
}
