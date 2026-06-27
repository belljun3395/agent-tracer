/**
 * Clock — abstracts wall-clock access so services that record timestamps stay
 * deterministic under test. Self-contained: no external imports.
 */
export interface IClock {
    /** Epoch milliseconds. */
    nowMs(): number;
    /** ISO-8601 timestamp string (UTC). */
    nowIso(): string;
}
