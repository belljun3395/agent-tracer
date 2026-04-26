export function clampLimit(value: unknown, defaultValue: number, max: number): number {
    if (typeof value !== "string") return defaultValue;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
    return Math.min(Math.max(parsed, 1), max);
}

export function optionalTrimmed(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
