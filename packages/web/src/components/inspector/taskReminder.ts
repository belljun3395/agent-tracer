export interface TaskReminderItem {
    readonly id?: string;
    readonly subject?: string;
    readonly description?: string;
    readonly status?: string;
    readonly blocks?: readonly string[];
    readonly blockedBy?: readonly string[];
}

function toStringList(value: unknown): readonly string[] | undefined {
    if (Array.isArray(value)) {
        const out = value.filter((item): item is string => typeof item === "string" && item.length > 0);
        return out.length > 0 ? out : undefined;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return [value.trim()];
    }
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function coerceTaskReminderArray(value: unknown): readonly unknown[] {
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
        const nested = value["items"] ?? value["content"];
        return Array.isArray(nested) ? nested : [];
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            return coerceTaskReminderArray(JSON.parse(trimmed));
        } catch {
            return [];
        }
    }
    return [];
}

export function parseTaskReminderItems(value: unknown): readonly TaskReminderItem[] {
    const rawItems = coerceTaskReminderArray(value);
    if (rawItems.length === 0) return [];

    return rawItems
        .filter(isRecord)
        .map((entry) => {
            const id = typeof entry["id"] === "string" ? entry["id"] : undefined;
            const subject = typeof entry["subject"] === "string" ? entry["subject"] : undefined;
            const description = typeof entry["description"] === "string" ? entry["description"] : undefined;
            const status = typeof entry["status"] === "string" ? entry["status"] : undefined;
            const blocks = toStringList(entry["blocks"]);
            const blockedBy = toStringList(entry["blockedBy"]);
            return {
                ...(id ? { id } : {}),
                ...(subject ? { subject } : {}),
                ...(description ? { description } : {}),
                ...(status ? { status } : {}),
                ...(blocks ? { blocks } : {}),
                ...(blockedBy ? { blockedBy } : {}),
            };
        });
}
