export interface IClock {
    nowMs(): number;
    nowIso(): string;
}
