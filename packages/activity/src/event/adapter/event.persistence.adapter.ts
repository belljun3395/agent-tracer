import { Inject, Injectable } from "@nestjs/common";
import { TimelineEventStorageService } from "../service/timeline.event.storage.service.js";
import { EVENT_SEARCH_INDEX_PORT } from "../application/outbound/tokens.js";
import type { IEventSearchIndex } from "../application/outbound/event.search.index.port.js";
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
    ) {}

    async findById(id: string): Promise<PersistedTimelineEvent | null> {
        return this.storage.findById(id);
    }

    async findByTaskId(taskId: string): Promise<readonly PersistedTimelineEvent[]> {
        return this.storage.findByTaskId(taskId);
    }

    async insert(input: TimelineEventInsertRequest): Promise<PersistedTimelineEvent> {
        const event = await this.storage.insert(input);
        await this.searchIndex.refresh(input.id);
        return event;
    }

    async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<PersistedTimelineEvent | null> {
        const event = await this.storage.updateMetadata(eventId, metadata);
        if (event) await this.searchIndex.refresh(eventId);
        return event;
    }

    async search(query: string, options: EventSearchOptions): Promise<EventSearchResults> {
        return this.searchIndex.search(query, options);
    }
}
