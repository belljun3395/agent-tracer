import * as fs from "node:fs";
import * as path from "node:path";
import { PROJECT_DIR } from "./paths.js";
import { isRecord } from "./utils.js";
import type { JsonObject } from "./utils.js";

const LOG_FILE = path.join(PROJECT_DIR, ".claude", "hooks.log");
const LOG_ENABLED = process.env.NODE_ENV === "development";

function appendLog(line: string): void {
    if (!LOG_ENABLED) return;
    try {
        fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
        void 0;
    }
}

export function hookLog(hookName: string, message: string, data?: Record<string, unknown>): void {
    const ts = new Date().toISOString().slice(11, 23);
    const logData = data
        ? { timestamp: new Date().toISOString(), ...data }
        : { timestamp: new Date().toISOString() };
    const dataStr = ` ${JSON.stringify(logData)}`;
    const line = `[${ts}][HOOK:${hookName}] ${message}${dataStr}`;
    if (process.env["NODE_ENV"] === "development") {
        process.stderr.write(line + "\n");
    }
    appendLog(line);
}

export function hookLogPayload(hookName: string, payload: JsonObject): void {
    const ts = new Date().toISOString().slice(11, 23);
    const { tool_response: _tr, transcript_path: _tp, ...rest } = payload;
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
