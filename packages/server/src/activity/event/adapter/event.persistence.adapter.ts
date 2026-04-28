import { Inject, Injectable } from "@nestjs/common";
import { TimelineEventStorageService } from "../service/timeline.event.storage.service.js";
import {
    EVENT_SEARCH_INDEX_PORT,
    EVENT_STORE_APPENDER_PORT,
} from "../application/outbound/tokens.js";
import type { IEventSearchIndex } from "../application/outbound/event.search.index.port.js";
import type { IEventStoreAppender } from "../application/outbound/event.store.appender.port.js";
import type {
    EventSearchOptions,
    EventSearchResults,
    IEventPersistence,
    PersistedTimelineEvent,
    TimelineEventInsertRequest,
} from "../application/outbound/event.persistence.port.js";

/**
 * Outbound adapter — implements IEventPersistence by composing the TypeORM
 * storage service for table writes/reads with two side-effect ports for
 * search-document refresh and domain-event sourcing. The search query path
 * still goes through the legacy FTS helpers (via IEventSearchIndex).
 */
@Injectable()
export class EventPersistenceAdapter implements IEventPersistence {
    constructor(
        private readonly storage: TimelineEventStorageService,
        @Inject(EVENT_SEARCH_INDEX_PORT) private readonly searchIndex: IEventSearchIndex,
        @Inject(EVENT_STORE_APPENDER_PORT) private readonly eventStore: IEventStoreAppender,
    ) {}

    async findById(id: string): Promise<PersistedTimelineEvent | null> {
        const event = await this.storage.findById(id);
        return event as unknown as PersistedTimelineEvent | null;
    }

    async findByTaskId(taskId: string): Promise<readonly PersistedTimelineEvent[]> {
        const events = await this.storage.findByTaskId(taskId);
        return events as unknown as readonly PersistedTimelineEvent[];
    }

    async insert(input: TimelineEventInsertRequest): Promise<PersistedTimelineEvent> {
        const event = await this.storage.insert(input);
        await this.eventStore.append(input);
        await this.searchIndex.refresh(input.id);
        return event as unknown as PersistedTimelineEvent;
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<PersistedTimelineEvent | null> {
        const event = await this.storage.updateMetadata(eventId, metadata);
        if (event) await this.searchIndex.refresh(eventId);
        return event as unknown as PersistedTimelineEvent | null;
    }

    async search(query: string, options: EventSearchOptions): Promise<EventSearchResults> {
        const result = await this.searchIndex.search(query, options);
        return result as unknown as EventSearchResults;
    }
}
