export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getToolInput(event: JsonObject): JsonObject {
    return isRecord(event.tool_input) ? event.tool_input : {};
}

export function getSessionId(event: JsonObject): string {
    const hookSource = toTrimmedString(event.hook_source);
    if (hookSource && hookSource !== "claude-hook") {
        return "";
    }
    return toTrimmedString(event.session_id);
}

export function getHookEventName(event: JsonObject): string {
    return toTrimmedString(event.hook_event_name);
}

export function toTrimmedString(value: unknown, maxLength?: number): string {
    const next = typeof value === "string"
        ? value.trim()
        : (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
            ? String(value).trim()
            : "";
    if (!maxLength || next.length <= maxLength) return next;
    return next.slice(0, maxLength);
}

export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function stringifyToolInput(input: JsonObject, maxValueLength: number = 10000): Record<string, string> {
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, toTrimmedString(value, maxValueLength)])
    );
}

import * as crypto from "node:crypto";

export function createMessageId(): string {
    return crypto.randomUUID();
}

export function createStableTodoId(content: string, priority: string): string {
    return crypto
        .createHash("sha1")
        .update(`${content}::${priority}`)
        .digest("hex")
        .slice(0, 16);
}
