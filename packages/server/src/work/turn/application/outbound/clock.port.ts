/**
 * Clock — abstracts wall-clock access. Self-contained, no external imports.
 */
export interface IClock {
    nowMs(): number;
    nowIso(): string;
}
