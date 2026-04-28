/**
 * Outbound port — FTS / search-document index side effects.
 * Self-contained: no external imports.
 *
 * Adapter today: thin wrapper over the legacy sqlite search helpers, sharing
 * the same SQLite database file as TypeORM (WAL mode). Will be replaced when
 * the search tier is migrated.
 */

export interface EventSearchIndexQueryOptions {
    readonly taskId?: string;
    readonly limit?: number;
}

export interface EventSearchIndexResults {
    readonly tasks: readonly unknown[];
    readonly events: readonly unknown[];
    readonly bookmarks: readonly unknown[];
}

export interface IEventSearchIndex {
    refresh(eventId: string): Promise<void>;
    search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults>;
}
