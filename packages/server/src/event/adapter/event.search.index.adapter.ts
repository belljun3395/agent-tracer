import { Inject, Injectable } from "@nestjs/common";
import {
    refreshEventSearchDocument,
    searchEvents,
} from "~adapters/persistence/sqlite/search/sqlite.event.search.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import {
    EMBEDDING_SERVICE_TOKEN,
    SQLITE_DATABASE_CONTEXT_TOKEN,
} from "~main/presentation/database/database.provider.js";
import type {
    EventSearchIndexQueryOptions,
    EventSearchIndexResults,
    IEventSearchIndex,
} from "../application/outbound/event.search.index.port.js";

/**
 * Outbound adapter — bridges event module's IEventSearchIndex port to the
 * legacy sqlite FTS helpers (`searchEvents` + `refreshEventSearchDocument`).
 * Calls the helpers directly so the legacy SqliteEventRepository is not
 * needed in the DI graph.
 */
@Injectable()
export class EventSearchIndexAdapter implements IEventSearchIndex {
    constructor(
        @Inject(SQLITE_DATABASE_CONTEXT_TOKEN) private readonly context: SqliteDatabaseContext,
        @Inject(EMBEDDING_SERVICE_TOKEN) private readonly embedding: IEmbeddingService | null,
    ) {}

    refresh(eventId: string): Promise<void> {
        refreshEventSearchDocument(this.context.db, eventId);
        return Promise.resolve();
    }

    async search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults> {
        const result = await searchEvents(
            this.context.client,
            this.embedding ?? undefined,
            query,
            options as never,
        );
        return result as unknown as EventSearchIndexResults;
    }
}
