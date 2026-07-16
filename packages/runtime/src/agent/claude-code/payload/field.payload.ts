import {isRecord} from "~runtime/support/json.js";
import {toBoolean, toTrimmedString} from "~runtime/support/text.js";

/** 훅 번들은 스키마 라이브러리를 실을 수 없으므로 stdin 필드를 손으로 읽어 좁힌다. */
export type ReaderResult<T> =
    | {readonly ok: true; readonly value: T}
    | {readonly ok: false; readonly reason: string};

/** 리더가 어떤 필수 필드도 없을 때 내는 실패 결과다. */
export type ReaderRejection = {readonly ok: false; readonly reason: string};

/** session_id 필드를 필수로 강제하는 리더 가드다. */
export function requireSessionId(raw: Record<string, unknown>): ReaderRejection | null {
    return readString(raw, "session_id") ? null : {ok: false, reason: "missing session_id"};
}

/** tool_name 필드를 필수로 강제하는 리더 가드다. */
export function requireToolName(raw: Record<string, unknown>): ReaderRejection | null {
    return readString(raw, "tool_name") ? null : {ok: false, reason: "missing tool_name"};
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
    return toBoolean(raw[field]);
}

export function readNumber(raw: Record<string, unknown>, field: string): number | undefined {
    const value = raw[field];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
