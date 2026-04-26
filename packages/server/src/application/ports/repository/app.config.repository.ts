export interface AppConfigEntry {
    readonly key: string;
    readonly value: unknown;
    readonly updatedAt: string;
}

export interface IAppConfigRepository {
    /** Get a single value by key. Returns null when missing. */
    get(key: string): Promise<unknown>;
    /** Get all entries as a key→value map. */
    getAll(): Promise<Record<string, unknown>>;
    /** Upsert one or more keys. Other keys remain untouched. */
    setMany(updates: Record<string, unknown>): Promise<void>;
    /** Delete a key. Returns true if a row was removed. */
    delete(key: string): Promise<boolean>;
}
