import { Inject, Injectable } from "@nestjs/common";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "~main/presentation/database/database.provider.js";
import { appendDomainEvent } from "../repository/event-store/event.store.js";
import type {
    DomainEventAppendInput,
    IDomainEventAppender,
} from "../public/iservice/domain.event.appender.iservice.js";

/**
 * Public adapter — implements IDomainEventAppender. Lets other modules
 * (turn-partition, future ones) append a domain event without coupling to
 * SQLite or the event-store layout.
 */
@Injectable()
export class DomainEventAppenderPublicAdapter implements IDomainEventAppender {
    constructor(
        @Inject(SQLITE_DATABASE_CONTEXT_TOKEN) private readonly context: SqliteDatabaseContext,
    ) {}

    append(input: DomainEventAppendInput): void {
        appendDomainEvent(this.context.client, {
            eventTime: input.eventTime,
            eventType: input.eventType as never,
            schemaVer: input.schemaVer,
            aggregateId: input.aggregateId,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            actor: input.actor,
            ...(input.correlationId ? { correlationId: input.correlationId } : {}),
            ...(input.causationId ? { causationId: input.causationId } : {}),
            payload: input.payload as never,
        });
    }
}
