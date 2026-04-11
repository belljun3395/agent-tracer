import { brandString, hasText, trimValue, StringValueObject } from "../shared/string-brands.js";
/**
 * Converts a task title into a URL-safe slug with a bounded length.
 */
function slugify(value) {
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
function normalizeWorkspacePathValue(value) {
    const normalized = value.trim().replace(/\/+/g, "/");
    return normalized.endsWith("/") && normalized !== "/"
        ? normalized.slice(0, -1)
        : normalized;
}
export class TaskIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? TaskIdValue.create(value) : undefined;
    }
}
export class SessionIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? SessionIdValue.create(value) : undefined;
    }
}
export class EventIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? EventIdValue.create(value) : undefined;
    }
}
export class BookmarkIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? BookmarkIdValue.create(value) : undefined;
    }
}
export class RuntimeSessionIdValue extends StringValueObject {
    static create(value) {
        return brandString(value);
    }
    static parse(value) {
        return hasText(value) ? RuntimeSessionIdValue.create(value) : undefined;
    }
}
export class RuntimeSourceValue extends StringValueObject {
    static create(value) {
        return brandString(trimValue(value));
    }
    static parse(value) {
        return hasText(value) ? RuntimeSourceValue.create(value) : undefined;
    }
}
export class WorkspacePathValue extends StringValueObject {
    static create(value) {
        return brandString(normalizeWorkspacePathValue(value));
    }
    static parse(value) {
        return hasText(value) ? WorkspacePathValue.create(value) : undefined;
    }
}
export class TaskSlugValue extends StringValueObject {
    static create(value) {
        return brandString(slugify(value));
    }
    static parse(value) {
        return hasText(value) ? TaskSlugValue.create(value) : undefined;
    }
}
export const TaskId = (s) => TaskIdValue.create(s);
export const SessionId = (s) => SessionIdValue.create(s);
export const EventId = (s) => EventIdValue.create(s);
export const BookmarkId = (s) => BookmarkIdValue.create(s);
export const RuntimeSessionId = (s) => RuntimeSessionIdValue.create(s);
export const RuntimeSource = (s) => RuntimeSourceValue.create(s);
export const WorkspacePath = (s) => WorkspacePathValue.create(s);
export const TaskSlug = (s) => TaskSlugValue.create(s);
//# sourceMappingURL=ids.js.map