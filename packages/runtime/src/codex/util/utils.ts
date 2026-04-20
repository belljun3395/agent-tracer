import { randomUUID } from "node:crypto";

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toTrimmedString(value: unknown, maxLength?: number): string {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) return "";
    return typeof maxLength === "number" && maxLength >= 0
        ? normalized.slice(0, maxLength)
        : normalized;
}

export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return value.slice(0, maxLength);
    return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function createMessageId(prefix: string = "msg"): string {
    return `${prefix}_${randomUUID()}`;
}

export function parseJsonLine(raw: string): JsonObject | null {
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as JsonObject) : null;
}
