import { Inject, Injectable } from "@nestjs/common";
import type { IDomainEventAppender } from "~event/public/iservice/domain.event.appender.iservice.js";
import { DOMAIN_EVENT_APPENDER } from "~event/public/tokens.js";
import type {
    IEventStoreAppender,
    TurnPartitionDomainEvent,
} from "../application/outbound/event.store.appender.port.js";

function eventTimeFromIso(value: string | undefined, fallback = Date.now()): number {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Outbound adapter — wraps the event module's public IDomainEventAppender
 * iservice so turn-partition records `turn.partition_*` events without
 * touching the event-store internals directly.
 */
@Injectable()
export class EventStoreAppenderAdapter implements IEventStoreAppender {
    constructor(
        @Inject(DOMAIN_EVENT_APPENDER) private readonly inner: IDomainEventAppender,
    ) {}

    append(event: TurnPartitionDomainEvent): void {
        if (event.type === "turn.partition_updated") {
            this.inner.append({
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
        this.inner.append({
            eventTime: eventTimeFromIso(event.resetAt),
            eventType: "turn.partition_reset",
            schemaVer: 1,
            aggregateId: event.taskId,
            actor: "user",
            payload: { task_id: event.taskId },
        });
    }
}
