export interface IIdGenerator {
    newUuid(): string;
    /** ULID. `timeMs` lets callers (event-store, subscribers, replay) embed an explicit ms timestamp. */
    newUlid(timeMs?: number): string;
}
