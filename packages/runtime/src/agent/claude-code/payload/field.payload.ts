import {isRecord} from "~runtime/support/json.js";
import {toBoolean, toTrimmedString} from "~runtime/support/text.js";

/** 훅 번들은 스키마 라이브러리를 실을 수 없으므로 stdin 필드를 손으로 읽어 좁힌다. */
export type ReaderResult<T> =
    | {readonly ok: true; readonly value: T}
    | {readonly ok: false; readonly reason: string};

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
    return toBoolean(raw[field]);
}

export function readNumber(raw: Record<string, unknown>, field: string): number | undefined {
    const value = raw[field];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
