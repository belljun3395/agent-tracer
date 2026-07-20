export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;

export interface SearchLimitBounds {
    readonly default: number;
    readonly max: number;
}

const DEFAULT_BOUNDS: SearchLimitBounds = { default: DEFAULT_SEARCH_LIMIT, max: MAX_SEARCH_LIMIT };

export function clampSearchLimit(raw: number | undefined, bounds: SearchLimitBounds = DEFAULT_BOUNDS): number {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return bounds.default;
    return Math.min(Math.floor(raw), bounds.max);
}
