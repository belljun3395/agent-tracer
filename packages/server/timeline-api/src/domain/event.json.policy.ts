export function parseJsonRecord(value: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(value);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
