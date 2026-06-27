/**
 * Outbound port — event full-text search. Self-contained: no external imports.
 *
 * Backed by Postgres pg_trgm ILIKE over timeline_events (no separate index, no
 * dual-write). Events only — task search is owned by work; the web fans out to
 * both and merges.
 */

export interface EventSearchIndexQueryOptions {
    readonly taskId?: string;
    readonly limit?: number;
}

export interface EventSearchIndexResults {
    readonly events: readonly unknown[];
}

export interface IEventSearchIndex {
    search(query: string, options: EventSearchIndexQueryOptions): Promise<EventSearchIndexResults>;
}
