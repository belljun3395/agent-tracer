/**
 * IdGenerator — abstracts identifier generation so services / subscribers
 * that mint IDs stay deterministic under test. Self-contained: no external
 * imports.
 */
export interface IIdGenerator {
    /** A new RFC-4122 UUID v4 string. */
    newUuid(): string;
    /**
     * A new ULID. `timeMs` lets callers (subscribers, replay tools) embed an
     * explicit timestamp; omit to use the adapter's clock. The random suffix
     * is always entropic.
     */
    newUlid(timeMs?: number): string;
}
