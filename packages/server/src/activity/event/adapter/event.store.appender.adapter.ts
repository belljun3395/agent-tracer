import { Inject, Injectable } from "@nestjs/common";
import { appendDomainEvent } from "../repository/event-store/event.store.js";
import { mapTimelineInsertToDomainEvent } from "../repository/event-store/timeline.event.mapper.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    DomainEventAppendInput,
    IEventStoreAppender,
} from "../application/outbound/event.store.appender.port.js";

/**
 * Outbound adapter — translates a freshly inserted timeline event into a
 * domain-event sourcing entry. Wraps the legacy sqlite event store; will
 * move when the event-sourcing tier migrates.
 */
@Injectable()
export class EventStoreAppenderAdapter implements IEventStoreAppender {
    constructor(
        @Inject(SQLITE_DATABASE_CONTEXT_TOKEN) private readonly context: SqliteDatabaseContext,
    ) {}

    append(input: DomainEventAppendInput): Promise<void> {
        const draft = mapTimelineInsertToDomainEvent(input as never);
        if (draft) appendDomainEvent(this.context.client, draft);
        return Promise.resolve();
    }
}
