import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
    refreshEventSearchDocument,
    searchEvents,
} from "../repository/search/event.search.js";
import type { IEmbeddingService } from "../repository/embedding/embedding.service.js";
import { EMBEDDING_SERVICE_TOKEN } from "../repository/embedding/tokens.js";
import type {
    EventSearchIndexQueryOptions,
    EventSearchIndexResults,
    IEventSearchIndex,
} from "../application/outbound/event.search.index.port.js";

/**
 * Outbound adapter — bridges event module's IEventSearchIndex port to the
 * module-internal search helpers. Uses TypeORM EntityManager so the same code
 * runs on any TypeORM-supported driver (better-sqlite3, postgres, ...).
 */
@Injectable()
export class EventSearchIndexAdapter implements IEventSearchIndex {
    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        @Inject(EMBEDDING_SERVICE_TOKEN) private readonly embedding: IEmbeddingService | null,
    ) {}

    async refresh(eventId: string): Promise<void> {
        await refreshEventSearchDocument(this.dataSource.manager, eventId);
    }

    async search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults> {
        const result = await searchEvents(
            this.dataSource.manager,
            this.embedding ?? undefined,
            query,
            options as never,
        );
        return result as unknown as EventSearchIndexResults;
    }
}
