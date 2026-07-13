export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;

export function clampSearchLimit(raw: number | undefined): number {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return DEFAULT_SEARCH_LIMIT;
    return Math.min(Math.floor(raw), MAX_SEARCH_LIMIT);
}
