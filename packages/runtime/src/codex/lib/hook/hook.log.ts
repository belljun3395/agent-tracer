import * as fs from "node:fs";
import * as path from "node:path";
import {PROJECT_DIR} from "~codex/util/paths.const.js";
import type {JsonObject} from "~codex/util/utils.js";
import {isRecord} from "~codex/util/utils.js";

const LOG_FILE = path.join(PROJECT_DIR, ".codex", "hooks.log");
const LOG_ENABLED = process.env.NODE_ENV === "development";

function appendLog(line: string): void {
    if (!LOG_ENABLED) return;
    try {
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
        void 0;
    }
}

/**
 * Writes a structured log line to stderr (in development mode) and appends it to `.codex/hooks.log`.
 * The line includes the hook name, message, timestamp, and any optional data fields.
 */
export function hookLog(hookName: string, message: string, data?: Record<string, unknown>): void {
    const ts = new Date().toISOString().slice(11, 23);
    const logData = data
        ? {timestamp: new Date().toISOString(), ...data}
        : {timestamp: new Date().toISOString()};
    const dataStr = ` ${JSON.stringify(logData)}`;
    const line = `[${ts}][HOOK:${hookName}] ${message}${dataStr}`;
    if (process.env["NODE_ENV"] === "development") {
        process.stderr.write(line + "\n");
    }
    appendLog(line);
}

/**
 * Logs the raw hook payload via `hookLog`, sanitising large `tool_input` string values
 * and omitting `tool_response` to keep log output manageable.
 */
export function hookLogPayload(hookName: string, payload: JsonObject): void {
    const ts = new Date().toISOString().slice(11, 23);
    const {tool_response: _tr, ...rest} = payload;
    if (isRecord(rest.tool_input)) {
        rest.tool_input = Object.fromEntries(
            Object.entries(rest.tool_input).map(([k, v]) =>
                typeof v === "string" && v.length > 200 ? [k, v.slice(0, 200) + "…"] : [k, v]
            )
        );
    }
    const line = `[${ts}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`;
    appendLog(line);
}
