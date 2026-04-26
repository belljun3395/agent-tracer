import { type Provider } from "@nestjs/common";
import { SqliteEventStore } from "~adapters/persistence/sqlite/events/sqlite.event-store.js";
import { createSqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { SqliteRuntimeBindingRepository } from "~adapters/persistence/sqlite/runtime-bindings/sqlite.runtime.binding.repository.js";
import { SqliteSessionRepository } from "~adapters/persistence/sqlite/sessions/sqlite.session.repository.js";
import { SqliteTaskRepository } from "~adapters/persistence/sqlite/tasks/sqlite.task.repository.js";
import { SqliteEventRepository } from "~adapters/persistence/sqlite/timeline-events/sqlite.event.repository.js";
import { SqliteTurnPartitionRepository } from "~adapters/persistence/sqlite/turn-partitions/sqlite.turn.partition.repository.js";
import { SqliteRuleEnforcementRepository } from "~adapters/persistence/sqlite/verification/rule-enforcements/sqlite.rule.enforcement.repository.js";
import { SqliteRuleRepository } from "~adapters/persistence/sqlite/verification/rules/sqlite.rule.repository.js";
import { SqliteTurnQueryRepository } from "~adapters/persistence/sqlite/verification/turns/sqlite.turn.query.repository.js";
import { SqliteTurnRepository } from "~adapters/persistence/sqlite/verification/turns/sqlite.turn.repository.js";
import { SqliteVerdictRepository } from "~adapters/persistence/sqlite/verification/verdicts/sqlite.verdict.repository.js";
import { createEmbeddingService } from "~adapters/ai/embedding/embedding.service.js";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";

export const SQLITE_DATABASE_CONTEXT_TOKEN = "SQLITE_DATABASE_CONTEXT";
export const EMBEDDING_SERVICE_TOKEN = "EMBEDDING_SERVICE";
export const TASK_REPOSITORY_TOKEN = "TASK_REPOSITORY";
export const SESSION_REPOSITORY_TOKEN = "SESSION_REPOSITORY";
export const EVENT_REPOSITORY_TOKEN = "EVENT_REPOSITORY";
export const EVENT_STORE_TOKEN = "EVENT_STORE";
export const RUNTIME_BINDING_REPOSITORY_TOKEN = "RUNTIME_BINDING_REPOSITORY";
export const TURN_PARTITION_REPOSITORY_TOKEN = "TURN_PARTITION_REPOSITORY";
export const RULE_REPOSITORY_TOKEN = "RULE_REPOSITORY";
export const TURN_REPOSITORY_TOKEN = "TURN_REPOSITORY";
export const VERDICT_REPOSITORY_TOKEN = "VERDICT_REPOSITORY";
export const RULE_ENFORCEMENT_REPOSITORY_TOKEN = "RULE_ENFORCEMENT_REPOSITORY";
export const TURN_QUERY_REPOSITORY_TOKEN = "TURN_QUERY_REPOSITORY";
export const NOTIFICATION_PUBLISHER_TOKEN = "NOTIFICATION_PUBLISHER";

export const DATABASE_PORT_TOKENS = [
    TASK_REPOSITORY_TOKEN,
    SESSION_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    EVENT_STORE_TOKEN,
    RUNTIME_BINDING_REPOSITORY_TOKEN,
    TURN_PARTITION_REPOSITORY_TOKEN,
    RULE_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
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
            provide: TURN_PARTITION_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteTurnPartitionRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: RULE_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteRuleRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: TURN_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteTurnRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: VERDICT_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteVerdictRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: RULE_ENFORCEMENT_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteRuleEnforcementRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
        {
            provide: TURN_QUERY_REPOSITORY_TOKEN,
            useFactory: (context: SqliteDatabaseContext) => new SqliteTurnQueryRepository(context.db),
            inject: [SQLITE_DATABASE_CONTEXT_TOKEN],
        },
    ];
}
