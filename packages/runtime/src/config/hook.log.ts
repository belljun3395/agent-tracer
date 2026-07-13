import * as fs from "node:fs";
import {isRecord, type JsonObject} from "~runtime/support/json.js";

/** 훅 실행 흔적을 파일에 남기는 로거다. */
export interface HookLogger {
    readonly log: (hookName: string, message: string, data?: Record<string, unknown>) => void;
    readonly logPayload: (hookName: string, payload: JsonObject) => void;
}

export interface HookLoggerConfig {
    readonly logFile: string;
    /** stderr 출력과 페이로드 덤프를 켠다. */
    readonly verbose: boolean;
}

// 크거나 민감해서 로그 파일에 쓰기 전 페이로드에서 지우는 키다.
const REDACT_KEYS = new Set([
    "tool_input",
    "tool_response",
    "transcript_path",
    "agent_transcript_path",
    "prompt",
    "last_assistant_message",
]);
const MAX_LOG_BYTES = 10 * 1024 * 1024;

function rotateIfLarge(logFile: string): void {
    try {
        if (fs.statSync(logFile).size < MAX_LOG_BYTES) return;
        fs.renameSync(logFile, `${logFile}.old`);
    } catch {
        return;
    }
}

export function createHookLogger(config: HookLoggerConfig): HookLogger {
    const appendLine = (line: string): void => {
        try {
            rotateIfLarge(config.logFile);
            fs.appendFileSync(config.logFile, `${line}\n`);
        } catch {
            return;
        }
    };

    const log: HookLogger["log"] = (hookName, message, data) => {
        const stamp = new Date().toISOString();
        const line = `[${stamp.slice(11, 23)}][HOOK:${hookName}] ${message} ${JSON.stringify({timestamp: stamp, ...data})}`;
        if (config.verbose) process.stderr.write(`${line}\n`);
        appendLine(line);
    };

    const logPayload: HookLogger["logPayload"] = (hookName, payload) => {
        if (!config.verbose) return;
        const rest: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
            if (!REDACT_KEYS.has(key)) rest[key] = value;
        }
        if (isRecord(rest["tool_input"])) {
            rest["tool_input"] = Object.fromEntries(
                Object.entries(rest["tool_input"]).map(([key, value]) =>
                    typeof value === "string" && value.length > 200 ? [key, `${value.slice(0, 200)}…`] : [key, value],
                ),
            );
        }
        appendLine(`[${new Date().toISOString().slice(11, 23)}][PAYLOAD:${hookName}] ${JSON.stringify(rest)}`);
    };

    return {log, logPayload};
}
