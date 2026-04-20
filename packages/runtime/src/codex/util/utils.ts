import { randomUUID } from "node:crypto";

export type JsonObject = Record<string, unknown>;

/** Returns true if `value` is a non-null, non-array plain object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Converts `value` to a trimmed string. Non-string values yield "".
 * If `maxLength` is provided the result is sliced to that length before return.
 */
export function toTrimmedString(value: unknown, maxLength?: number): string {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return "";
    return typeof maxLength === "number" && maxLength >= 0
        ? normalized.slice(0, maxLength)
        : normalized;
}

/** Truncates `value` to `maxLength` chars, appending "…" if trimmed. */
export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return value.slice(0, maxLength);
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

/** Generates a unique message ID of the form `<prefix>_<uuid>`. */
export function createMessageId(prefix: string = "msg"): string {
    return `${prefix}_${randomUUID()}`;
}

/**
 * Parses a single JSONL line. Returns null if the line is blank, fails to
 * parse, or produces a non-record value. Used by the rollout reader.
 */
export function parseJsonLine(raw: string): JsonObject | null {
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as JsonObject) : null;
}
