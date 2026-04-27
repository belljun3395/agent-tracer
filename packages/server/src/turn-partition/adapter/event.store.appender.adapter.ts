import { Inject, Injectable } from "@nestjs/common";
import { appendDomainEvent } from "~adapters/persistence/sqlite/events/sqlite.event-store.js";
import { eventTimeFromIso } from "~adapters/persistence/sqlite/events/event-time.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    IEventStoreAppender,
    TurnPartitionDomainEvent,
} from "../application/outbound/event.store.appender.port.js";

/**
 * Outbound adapter — wraps the legacy SqliteEventStore.appendDomainEvent
 * helper. Will move when the event-sourcing tier migrates.
 */
@Injectable()
export class EventStoreAppenderAdapter implements IEventStoreAppender {
    constructor(
        @Inject(SQLITE_DATABASE_CONTEXT_TOKEN) private readonly context: SqliteDatabaseContext,
    ) {}

    append(event: TurnPartitionDomainEvent): void {
        if (event.type === "turn.partition_updated") {
            appendDomainEvent(this.context.client, {
                eventTime: eventTimeFromIso(event.updatedAt),
                eventType: "turn.partition_updated",
                schemaVer: 1,
                aggregateId: event.taskId,
                actor: "user",
                payload: {
                    task_id: event.taskId,
                    version: event.version,
                    groups: event.groups.map((g) => ({ ...g })),
                },
            });
            return;
        }
        appendDomainEvent(this.context.client, {
            eventTime: eventTimeFromIso(event.resetAt),
            eventType: "turn.partition_reset",
            schemaVer: 1,
            aggregateId: event.taskId,
            actor: "user",
            payload: { task_id: event.taskId },
        });
    }
}
