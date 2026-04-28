import { Injectable } from "@nestjs/common";
import { EventStoreService } from "../repository/event-store/event.store.service.js";
import type {
    DomainEventAppendInput,
    IDomainEventAppender,
} from "../public/iservice/domain.event.appender.iservice.js";

/**
 * Public adapter — implements IDomainEventAppender. Lets other modules
 * (turn-partition, future ones) append a domain event without coupling to
 * the SQLite or event-store layout.
 */
@Injectable()
export class DomainEventAppenderPublicAdapter implements IDomainEventAppender {
    constructor(private readonly store: EventStoreService) {}

    async append(input: DomainEventAppendInput): Promise<void> {
        await this.store.append({
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
