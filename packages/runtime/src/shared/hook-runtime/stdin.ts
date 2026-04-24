import {isRecord} from "~shared/util/utils.js";

/**
 * Reads and accumulates the full stdin stream, then parses it as JSON.
 * Returns an empty object if stdin is empty or the parsed value is not a plain record.
 */
export async function readStdinJson(): Promise<Record<string, unknown>> {
    let raw = "";
    for await (const chunk of process.stdin) {
        raw += String(chunk);
    }
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
}
