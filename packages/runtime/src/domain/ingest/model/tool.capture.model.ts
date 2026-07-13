import {isRecord} from "~runtime/support/json.js";
import {truncateOutput} from "~runtime/support/text.js";

const TERMINAL_STDOUT_HEAD = 4096;
const TERMINAL_STDOUT_TAIL = 4096;
const TERMINAL_STDERR_HEAD = 2048;
const TERMINAL_STDERR_TAIL = 2048;
const TOOL_RESULT_HEAD = 2048;
const TOOL_RESULT_TAIL = 2048;

/** 터미널 도구 결과에서 원장에 남기는 필드다. */
export interface CapturedTerminalResult {
    readonly exitCode?: number;
    readonly interrupted?: boolean;
    readonly stdout?: string;
    readonly stderr?: string;
    readonly stdoutBytes?: number;
    readonly stderrBytes?: number;
    readonly stdoutTruncated?: boolean;
    readonly stderrTruncated?: boolean;
}

/** 일반 도구 결과에서 원장에 남기는 필드다. */
export interface CapturedToolResult {
    readonly resultText?: string;
    readonly resultBytes?: number;
    readonly resultTruncated?: boolean;
    readonly resultMatches?: number;
}

/** 문자열로 온 도구 응답은 stdout으로 받아 exitCode 없는 실행 결과도 원장에 남긴다. */
export function captureTerminalToolResponse(value: unknown): CapturedTerminalResult {
    if (typeof value === "string") {
        const result: Record<string, unknown> = {};
        captureText(result, "stdout", value, TERMINAL_STDOUT_HEAD, TERMINAL_STDOUT_TAIL);
        return result;
    }
    if (!isRecord(value)) return {};
    const result: Record<string, unknown> = {};
    const exit = value["exit_code"] ?? value["exitCode"];
    if (typeof exit === "number" && Number.isFinite(exit)) result["exitCode"] = exit;
    const interrupted = value["interrupted"] ?? value["wasInterrupted"];
    if (typeof interrupted === "boolean") result["interrupted"] = interrupted;
    captureText(result, "stdout", value["stdout"] ?? value["output"], TERMINAL_STDOUT_HEAD, TERMINAL_STDOUT_TAIL);
    captureText(result, "stderr", value["stderr"], TERMINAL_STDERR_HEAD, TERMINAL_STDERR_TAIL);
    return result;
}

/** 일반 도구 결과를 직렬화하고 저장 상한에 맞춰 head와 tail만 남긴다. */
export function captureToolResultBody(
    value: unknown,
    options: {readonly matchCounter?: (raw: unknown, text: string) => number | undefined} = {},
): CapturedToolResult {
    const text = stringifyToolResult(value);
    if (text === undefined) return {};
    const matches = options.matchCounter?.(value, text);
    const captured = truncateOutput(text, TOOL_RESULT_HEAD, TOOL_RESULT_TAIL);
    return {
        resultText: captured.body,
        resultBytes: captured.bytes,
        ...(captured.truncated ? {resultTruncated: true} : {}),
        ...(typeof matches === "number" && Number.isFinite(matches) ? {resultMatches: matches} : {}),
    };
}

function captureText(
    target: Record<string, unknown>,
    key: "stdout" | "stderr",
    value: unknown,
    head: number,
    tail: number,
): void {
    if (typeof value !== "string" || value.length === 0) return;
    const captured = truncateOutput(value, head, tail);
    target[key] = captured.body;
    target[`${key}Bytes`] = captured.bytes;
    if (captured.truncated) target[`${key}Truncated`] = true;
}

function stringifyToolResult(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "string") return value.length > 0 ? value : undefined;
    try {
        const json = JSON.stringify(value);
        return json && json !== "{}" && json !== "[]" ? json : undefined;
    } catch {
        return undefined;
    }
}
