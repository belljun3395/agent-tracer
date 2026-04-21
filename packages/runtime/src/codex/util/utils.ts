import {isRecord} from "~shared/util/utils.js";

export type {JsonObject} from "~shared/util/utils.js";
export {isRecord, toTrimmedString, ellipsize, createMessageId} from "~shared/util/utils.js";

/**
 * Parses a single JSONL line. Returns null if the line is blank, fails to
 * parse, or produces a non-record value. Used by the rollout reader.
 */
export function parseJsonLine(raw: string): Record<string, unknown> | null {
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
}
