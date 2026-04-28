export function eventTimeFromIso(value: string | undefined, fallback = Date.now()): number {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
