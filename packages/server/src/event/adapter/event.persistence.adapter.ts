import { Inject, Injectable } from "@nestjs/common";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import { EVENT_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    EventSearchOptions,
    EventSearchResults,
    IEventPersistence,
    PersistedTimelineEvent,
    TimelineEventInsertRequest,
} from "../application/outbound/event.persistence.port.js";

/**
 * Outbound adapter — bridges legacy SqliteEventRepository (multi-table schema)
 * to event module's local IEventPersistence port. Will be retargeted at a
 * TypeORM-backed implementation when the schema migrates.
 *
 * NOTE: this is the only place inside event module that imports from
 * ~application/ports/repository/* legacy paths.
 */
@Injectable()
export class EventPersistenceAdapter implements IEventPersistence {
    constructor(
        @Inject(EVENT_REPOSITORY_TOKEN) private readonly inner: IEventRepository,
    ) {}

    async findById(id: string): Promise<PersistedTimelineEvent | null> {
        const event = await this.inner.findById(id);
        return event as unknown as PersistedTimelineEvent | null;
    }

    async findByTaskId(taskId: string): Promise<readonly PersistedTimelineEvent[]> {
        const events = await this.inner.findByTaskId(taskId);
        return events as unknown as readonly PersistedTimelineEvent[];
    }

    async insert(input: TimelineEventInsertRequest): Promise<PersistedTimelineEvent> {
        const event = await this.inner.insert(input as never);
        return event as unknown as PersistedTimelineEvent;
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<PersistedTimelineEvent | null> {
        const event = await this.inner.updateMetadata(eventId, metadata);
        return event as unknown as PersistedTimelineEvent | null;
    }

    async search(query: string, options: EventSearchOptions): Promise<EventSearchResults> {
        const result = await this.inner.search(query, options as never);
        return result as unknown as EventSearchResults;
    }
}
