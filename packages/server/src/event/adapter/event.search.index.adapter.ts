import { Inject, Injectable } from "@nestjs/common";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import { EVENT_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import { refreshEventSearchDocument } from "~adapters/persistence/sqlite/search/sqlite.event.search.js";
import type { SqliteDatabaseContext } from "~adapters/persistence/sqlite/sqlite.database-context.js";
import { SQLITE_DATABASE_CONTEXT_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    EventSearchIndexQueryOptions,
    EventSearchIndexResults,
    IEventSearchIndex,
} from "../application/outbound/event.search.index.port.js";

/**
 * Outbound adapter — bridges event module's IEventSearchIndex port to the
 * legacy sqlite search helpers. Reads/refreshes operate on the same SQLite
 * file that TypeORM writes to (WAL mode), so the FTS doc reflects the latest
 * timeline_events_view rows produced by TimelineEventStorageService.
 */
@Injectable()
export class EventSearchIndexAdapter implements IEventSearchIndex {
    constructor(
        @Inject(SQLITE_DATABASE_CONTEXT_TOKEN) private readonly context: SqliteDatabaseContext,
        @Inject(EVENT_REPOSITORY_TOKEN) private readonly inner: IEventRepository,
    ) {}

    refresh(eventId: string): Promise<void> {
        refreshEventSearchDocument(this.context.db, eventId);
        return Promise.resolve();
    }

    async search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults> {
        const result = await this.inner.search(query, options as never);
        return result as unknown as EventSearchIndexResults;
    }
}
