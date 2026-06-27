

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
