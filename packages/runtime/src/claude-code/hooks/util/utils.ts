import * as crypto from "node:crypto";
import {toTrimmedString} from "~shared/util/utils.js";

export {JsonObject, isRecord, toTrimmedString, ellipsize, createMessageId} from "~shared/util/utils.js";

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
