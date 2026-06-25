/**
 * Global DI tokens for clock and id-generator — shared across all modules
 * so each module uses the same provider registered in DatabaseModule.
 */
export const CLOCK_PORT = "CLOCK_PORT" as const;
export const ID_GENERATOR_PORT = "ID_GENERATOR_PORT" as const;

export interface IClock {
    /** Epoch milliseconds. */
    nowMs(): number;
    /** ISO-8601 timestamp string (UTC). */
    nowIso(): string;
}

export interface IIdGenerator {
    /** A new RFC-4122 UUID v4 string. */
    newUuid(): string;
    /**
     * A new ULID. `timeMs` lets callers embed an explicit timestamp;
     * omit to use the clock. The random suffix is always entropic.
     */
    newUlid(timeMs?: number): string;
}
