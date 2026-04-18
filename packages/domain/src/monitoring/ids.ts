import { brandString, hasText, trimValue, type StringBrand, StringValueObject } from "../shared/string-brands.js";

/**
 * Converts a task title into a URL-safe slug with a bounded length.
 */
function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
}

/**
 * Cleans workspace paths by collapsing repeated separators and trimming a trailing slash.
 */
function normalizeWorkspacePathValue(value: string): string {
    const normalized = value.trim().replace(/\/+/g, "/");
    return normalized.endsWith("/") && normalized !== "/"
        ? normalized.slice(0, -1)
        : normalized;
}

export type TaskId = StringBrand<"TaskId">;
export type SessionId = StringBrand<"SessionId">;
export type EventId = StringBrand<"EventId">;
export type BookmarkId = StringBrand<"BookmarkId">;
export type RuntimeSessionId = StringBrand<"RuntimeSessionId">;
export type RuntimeSource = StringBrand<"RuntimeSource">;
export type WorkspacePath = StringBrand<"WorkspacePath">;
export type TaskSlug = StringBrand<"TaskSlug">;

export class TaskIdValue extends StringValueObject<"TaskId"> {
    static create(value: string): TaskId {
        return brandString<"TaskId">(value);
    }

    static parse(value: unknown): TaskId | undefined {
        return hasText(value) ? TaskIdValue.create(value) : undefined;
    }
}

export class SessionIdValue extends StringValueObject<"SessionId"> {
    static create(value: string): SessionId {
        return brandString<"SessionId">(value);
    }

    static parse(value: unknown): SessionId | undefined {
        return hasText(value) ? SessionIdValue.create(value) : undefined;
    }
}

export class EventIdValue extends StringValueObject<"EventId"> {
    static create(value: string): EventId {
        return brandString<"EventId">(value);
    }

    static parse(value: unknown): EventId | undefined {
        return hasText(value) ? EventIdValue.create(value) : undefined;
    }
}

export class BookmarkIdValue extends StringValueObject<"BookmarkId"> {
    static create(value: string): BookmarkId {
        return brandString<"BookmarkId">(value);
    }

    static parse(value: unknown): BookmarkId | undefined {
        return hasText(value) ? BookmarkIdValue.create(value) : undefined;
    }
}

export class RuntimeSessionIdValue extends StringValueObject<"RuntimeSessionId"> {
    static create(value: string): RuntimeSessionId {
        return brandString<"RuntimeSessionId">(value);
    }

    static parse(value: unknown): RuntimeSessionId | undefined {
        return hasText(value) ? RuntimeSessionIdValue.create(value) : undefined;
    }
}

export class RuntimeSourceValue extends StringValueObject<"RuntimeSource"> {
    static create(value: string): RuntimeSource {
        return brandString<"RuntimeSource">(trimValue(value));
    }

    static parse(value: unknown): RuntimeSource | undefined {
        return hasText(value) ? RuntimeSourceValue.create(value) : undefined;
    }
}

export class WorkspacePathValue extends StringValueObject<"WorkspacePath"> {
    static create(value: string): WorkspacePath {
        return brandString<"WorkspacePath">(normalizeWorkspacePathValue(value));
    }

    static parse(value: unknown): WorkspacePath | undefined {
        return hasText(value) ? WorkspacePathValue.create(value) : undefined;
    }
}

export class TaskSlugValue extends StringValueObject<"TaskSlug"> {
    static create(value: string): TaskSlug {
        return brandString<"TaskSlug">(slugify(value));
    }

    static parse(value: unknown): TaskSlug | undefined {
        return hasText(value) ? TaskSlugValue.create(value) : undefined;
    }
}

export const TaskId = (s: string): TaskId => TaskIdValue.create(s);
export const SessionId = (s: string): SessionId => SessionIdValue.create(s);
export const EventId = (s: string): EventId => EventIdValue.create(s);
export const BookmarkId = (s: string): BookmarkId => BookmarkIdValue.create(s);
export const RuntimeSessionId = (s: string): RuntimeSessionId => RuntimeSessionIdValue.create(s);
export const RuntimeSource = (s: string): RuntimeSource => RuntimeSourceValue.create(s);
export const WorkspacePath = (s: string): WorkspacePath => WorkspacePathValue.create(s);
export const TaskSlug = (s: string): TaskSlug => TaskSlugValue.create(s);
