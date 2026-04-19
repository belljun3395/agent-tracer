import * as crypto from "node:crypto";
import type {JsonObject} from "~claude-code/hooks/util/utils.type.js";

export type {JsonObject};

/**
 * Type guard that returns true if the value is a non-null, non-array plain object.
 * Narrows the type to `JsonObject` for safe property access.
 */
export function isRecord(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerces any value to a trimmed string, converting numbers, booleans, and bigints.
 * Non-coercible values become `""`. Optionally truncates the result to `maxLength` characters.
 */
export function toTrimmedString(value: unknown, maxLength?: number): string {
    const next = typeof value === "string"
        ? value.trim()
        : (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
            ? String(value).trim()
            : "";
    if (!maxLength || next.length <= maxLength) return next;
    return next.slice(0, maxLength);
}

/**
 * Same as `toTrimmedString` but returns `undefined` instead of an empty string.
 * Useful for optional fields where absence should be distinguished from an empty value.
 */
export function toOptionalTrimmedString(value: unknown, maxLength?: number): string | undefined {
    const next = toTrimmedString(value, maxLength);
    return next || undefined;
}

/**
 * Coerces various truthy/falsy representations (boolean, number, `"true"`, `"1"`, `"yes"`) to a boolean.
 * Any unrecognised value evaluates to `false`.
 */
export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

/**
 * Truncates a string to `maxLength` characters, appending `"…"` when the string is cut.
 * Returns the original string unchanged if it fits within the limit.
 */
export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

/**
 * Generates a random UUID for use as a unique message identifier.
 */
export function createMessageId(): string {
    return crypto.randomUUID();
}

/**
 * Derives a deterministic 16-character hex ID from a todo's `content` and `priority` via SHA-1.
 * Ensures the same todo always maps to the same ID across reconciliation runs.
 */
export function createStableTodoId(content: string, priority: string): string {
    return crypto
        .createHash("sha1")
        .update(`${content}::${priority}`)
        .digest("hex")
        .slice(0, 16);
}
