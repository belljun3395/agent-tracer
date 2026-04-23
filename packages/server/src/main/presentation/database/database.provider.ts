import { type Provider } from "@nestjs/common";
import {
    createSqliteDatabaseContext,
    SqliteBookmarkRepository,
    SqliteEvaluationRepository,
    SqliteEventRepository,
    SqliteEventStore,
    SqlitePlaybookRepository,
    SqliteRuleCommandRepository,
    SqliteRuntimeBindingRepository,
    SqliteSessionRepository,
    SqliteTaskRepository,
    SqliteTurnPartitionRepository,
    type SqliteDatabaseContext,
} from "~adapters/persistence/sqlite/index.js";
import { createEmbeddingService } from "~adapters/ai/embedding/index.js";
import type {
    IEmbeddingService,
    INotificationPublisher,
} from "~application/index.js";

export const SQLITE_DATABASE_CONTEXT_TOKEN = "SQLITE_DATABASE_CONTEXT";
export const EMBEDDING_SERVICE_TOKEN = "EMBEDDING_SERVICE";
export const TASK_REPOSITORY_TOKEN = "TASK_REPOSITORY";
export const SESSION_REPOSITORY_TOKEN = "SESSION_REPOSITORY";
export const EVENT_REPOSITORY_TOKEN = "EVENT_REPOSITORY";
export const EVENT_STORE_TOKEN = "EVENT_STORE";
export const RUNTIME_BINDING_REPOSITORY_TOKEN = "RUNTIME_BINDING_REPOSITORY";
export const BOOKMARK_REPOSITORY_TOKEN = "BOOKMARK_REPOSITORY";
export const EVALUATION_REPOSITORY_TOKEN = "EVALUATION_REPOSITORY";
export const PLAYBOOK_REPOSITORY_TOKEN = "PLAYBOOK_REPOSITORY";
export const RULE_COMMAND_REPOSITORY_TOKEN = "RULE_COMMAND_REPOSITORY";
export const TURN_PARTITION_REPOSITORY_TOKEN = "TURN_PARTITION_REPOSITORY";
export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export const DATABASE_PORT_TOKENS = [
    TASK_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    EVENT_STORE_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    BOOKMARK_REPOSITORY_TOKEN,
    EVALUATION_REPOSITORY_TOKEN,
    PLAYBOOK_REPOSITORY_TOKEN,
    RULE_COMMAND_REPOSITORY_TOKEN,
    TURN_PARTITION_REPOSITORY_TOKEN,
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
            provide: TASK_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteTaskRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: SESSION_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteSessionRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: EVENT_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext, embeddingService: IEmbeddingService | null) =>
                new SqliteEventRepository(context.db, embeddingService ?? undefined),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN, EMBEDDING_SERVICE_TOKEN],
        },
        {
            provide: EVENT_STORE_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteEventStore(context.client),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: RUNTIME_BINDING_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteRuntimeBindingRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: BOOKMARK_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteBookmarkRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: EVALUATION_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext, embeddingService: IEmbeddingService | null) =>
                new SqliteEvaluationRepository(context.db, embeddingService ?? undefined),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN, EMBEDDING_SERVICE_TOKEN],
        },
        {
            provide: PLAYBOOK_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext, embeddingService: IEmbeddingService | null) =>
                new SqlitePlaybookRepository(context.db, embeddingService ?? undefined),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN, EMBEDDING_SERVICE_TOKEN],
        },
        {
            provide: RULE_COMMAND_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteRuleCommandRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: TURN_PARTITION_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteTurnPartitionRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
    ];
}
