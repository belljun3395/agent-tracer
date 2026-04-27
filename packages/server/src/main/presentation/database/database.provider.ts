import { type Provider } from "@nestjs/common";
import { SqliteEventStore } from "~adapters/persistence/sqlite/events/sqlite.event-store.js";
import { createSqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { createEmbeddingService } from "~adapters/ai/embedding/embedding.service.js";
import type { INotificationPublisher } from "~application/ports/notifications/notification.publisher.port.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";

export const SQLITE_DATABASE_CONTEXT_TOKEN = "SQLITE_DATABASE_CONTEXT";
export const EMBEDDING_SERVICE_TOKEN = "EMBEDDING_SERVICE";
export const EVENT_STORE_TOKEN = "EVENT_STORE";
export const TURN_PARTITION_REPOSITORY_TOKEN = "TURN_PARTITION_REPOSITORY";
export const RULE_REPOSITORY_TOKEN = "RULE_REPOSITORY";
export const TURN_REPOSITORY_TOKEN = "TURN_REPOSITORY";
export const VERDICT_REPOSITORY_TOKEN = "VERDICT_REPOSITORY";
export const RULE_ENFORCEMENT_REPOSITORY_TOKEN = "RULE_ENFORCEMENT_REPOSITORY";
export const TURN_QUERY_REPOSITORY_TOKEN = "TURN_QUERY_REPOSITORY";
export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export const DATABASE_PORT_TOKENS = [
    EVENT_STORE_TOKEN,
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
            provide: EMBEDDING_SERVICE_TOKEN,
            useFactory: (): IEmbeddingService | null => createEmbeddingService() ?? null,
        },
        {
            provide: NOTIFICATION_PUBLISHER_TOKEN,
            useValue: options.notifier ?? noopNotifier,
        },
        {
            provide: EVENT_STORE_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteEventStore(context.client),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        // Note: event module owns timeline events (TypeORM); FTS reads/writes flow through
        //       EVENT_SEARCH_INDEX_PORT inside the event module which calls the legacy
        //       sqlite search helpers directly (no SqliteEventRepository instance needed).
        //       Other tokens are provided by their respective modules — see app.module.ts.
    ];
}
