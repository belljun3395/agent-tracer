/**
 * Lightweight, zero-dep validation helpers for hook stdin payloads.
 *
 * We intentionally avoid pulling in Zod or another schema library — the
 * runtime ships with the Claude Code / Codex plugin bundles and should stay
 * dep-free. Each hook declares a typed reader that coerces the raw JSON
 * object into a strict context interface, returning `ok: false` with an
 * error reason when required fields are missing.
 *
 * Convention: readers never throw. Hook handlers receive either a parsed
 * context or a typed reason string, and decide what to do (usually: log and
 * return, never block Claude).
 */
import {isRecord, toTrimmedString} from "~shared/util/utils.js";

export type ReaderResult<T> =
    | {readonly ok: true; readonly value: T}
    | {readonly ok: false; readonly reason: string};

export function required<T>(value: T | undefined, field: string): ReaderResult<T> {
    if (value === undefined || value === null) {
        return {ok: false, reason: `missing required field: ${field}`};
    }
    if (typeof value === "string" && value.length === 0) {
        return {ok: false, reason: `empty required field: ${field}`};
    }
    return {ok: true, value};
}

export function readString(raw: Record<string, unknown>, field: string): string {
    return toTrimmedString(raw[field]);
}

export function readOptionalString(raw: Record<string, unknown>, field: string): string | undefined {
    const value = toTrimmedString(raw[field]);
    return value || undefined;
}

export function readRecord(raw: Record<string, unknown>, field: string): Record<string, unknown> {
    const value = raw[field];
    return isRecord(value) ? value : {};
}

export function readStringArray(raw: Record<string, unknown>, field: string): string[] {
    const value = raw[field];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        const trimmed = toTrimmedString(entry);
        return trimmed ? [trimmed] : [];
    });
}

export function readBoolean(raw: Record<string, unknown>, field: string): boolean {
    const value = raw[field];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function readOneOf<T extends string>(
    raw: Record<string, unknown>,
    field: string,
    allowed: readonly T[],
): T | undefined {
    const value = toTrimmedString(raw[field]);
    return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
