export interface IIdGenerator {
    newUuid(): string;
    /** ULID. `timeMs` lets callers (subscribers, replay) embed an explicit ms timestamp. */
    newUlid(timeMs?: number): string;
}
