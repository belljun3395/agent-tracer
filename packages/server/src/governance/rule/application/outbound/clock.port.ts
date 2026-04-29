/**
 * Clock — abstracts wall-clock access so usecases that stamp timestamps stay
 * deterministic under test. Self-contained: no external imports.
 */
export interface IClock {
    nowMs(): number;
    nowIso(): string;
}
