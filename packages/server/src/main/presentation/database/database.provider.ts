import { type Provider } from "@nestjs/common";
import { createSqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import type { INotificationPublisher } from "~application/ports/notifications/notification.publisher.port.js";

export const SQLITE_DATABASE_CONTEXT_TOKEN = "SQLITE_DATABASE_CONTEXT";
export const TURN_PARTITION_REPOSITORY_TOKEN = "TURN_PARTITION_REPOSITORY";
export const RULE_REPOSITORY_TOKEN = "RULE_REPOSITORY";
export const TURN_REPOSITORY_TOKEN = "TURN_REPOSITORY";
export const VERDICT_REPOSITORY_TOKEN = "VERDICT_REPOSITORY";
export const RULE_ENFORCEMENT_REPOSITORY_TOKEN = "RULE_ENFORCEMENT_REPOSITORY";
export const TURN_QUERY_REPOSITORY_TOKEN = "TURN_QUERY_REPOSITORY";
export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export const DATABASE_PORT_TOKENS = [
    NOTIFICATION_PUBLISHER_TOKEN,
] as const;

export function DatabaseProviders(options: {
    databasePath: string;
    notifier?: INotificationPublisher;
}): Provider[] {
    const noopNotifier: INotificationPublisher = { publish: () => { } };

    return [
        {
            provide: SQLITE_DATABASE_CONTEXT_TOKEN,
            useFactory: (): SqliteDatabaseContext => createSqliteDatabaseContext(options.databasePath),
        },
        {
            provide: NOTIFICATION_PUBLISHER_TOKEN,
            useValue: options.notifier ?? noopNotifier,
        },
        // All repository tokens are now provided by their owning modules.
        // EMBEDDING_SERVICE_TOKEN moved to event module.
        // EVENT_STORE_TOKEN removed — consumers use DOMAIN_EVENT_APPENDER iservice instead.
    ];
}
