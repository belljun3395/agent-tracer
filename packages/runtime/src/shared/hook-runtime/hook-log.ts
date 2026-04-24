import * as fs from "node:fs";
import type {JsonObject} from "~shared/util/utils.type.js";
import {isRecord} from "~shared/util/utils.js";

export interface HookLogger {
    readonly log: (hookName: string, message: string, data?: Record<string, unknown>) => void;
    readonly logPayload: (hookName: string, payload: JsonObject) => void;
}

export interface HookLoggerConfig {
    readonly logFile: string;
    readonly enabled: boolean;
    /**
     * Keys to redact from payload before writing to the log file — the
     * corresponding values are large or sensitive (e.g. `tool_response`,
     * `transcript_path`).
     */
    readonly payloadRedactKeys?: readonly string[];
}

const DEFAULT_REDACT_KEYS = ["tool_response", "transcript_path"] as const;

export function createHookLogger(config: HookLoggerConfig): HookLogger {
    const redactKeys = new Set(config.payloadRedactKeys ?? DEFAULT_REDACT_KEYS);

    const appendLog = (line: string): void => {
        if (!config.enabled) return;
        try {
            fs.appendFileSync(config.logFile, line + "\n");
        } catch {
            void 0;
        }
    };

    const log: HookLogger["log"] = (hookName, message, data) => {
        const ts = new Date().toISOString().slice(11, 23);
        const logData = data
            ? {timestamp: new Date().toISOString(), ...data}
            : {timestamp: new Date().toISOString()};
        const line = `[${ts}][HOOK:${hookName}] ${message} ${JSON.stringify(logData)}`;
        if (config.enabled) {
            process.stderr.write(line + "\n");
        }
        appendLog(line);
    };

    const logPayload: HookLogger["logPayload"] = (hookName, payload) => {
        const ts = new Date().toISOString().slice(11, 23);
        const rest: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
            if (!redactKeys.has(key)) rest[key] = value;
        }
        if (isRecord(rest["tool_input"])) {
            rest["tool_input"] = Object.fromEntries(
                Object.entries(rest["tool_input"]).map(([k, v]) =>
                    typeof v === "string" && v.length > 200 ? [k, v.slice(0, 200) + "…"] : [k, v],
                ),
            );
        }
        const line = `[${ts}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`;
        appendLog(line);
    };

    return {log, logPayload};
}
