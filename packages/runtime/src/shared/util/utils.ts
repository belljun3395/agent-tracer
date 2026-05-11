import {randomUUID} from "node:crypto";
export type {JsonObject} from "~shared/util/utils.type.js";

/** Returns true if `value` is a non-null, non-array plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
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

/** Truncates `value` to `maxLength` chars, appending "…" if trimmed. */
export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return value.slice(0, maxLength);
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

/** Generates a random UUID for use as a unique message identifier. */
export function createMessageId(): string {
    return randomUUID();
}

/**
 * Head+tail truncation for captured tool output. Keeps the first and last
 * windows so a verifier can still tell what happened in long shell logs.
 */
export function truncateOutput(
    text: string,
    headChars: number,
    tailChars: number,
): {readonly body: string; readonly bytes: number; readonly truncated: boolean} {
    const bytes = Buffer.byteLength(text, "utf8");
    if (text.length <= headChars + tailChars) {
        return {body: text, bytes, truncated: false};
    }
    const head = text.slice(0, headChars);
    const tail = text.slice(text.length - tailChars);
    const omitted = text.length - headChars - tailChars;
    return {body: `${head}\n…[${omitted} chars omitted]…\n${tail}`, bytes, truncated: true};
}
