/**
 * Shared helpers for the per-tool PostToolUse handlers.
 *
 * Each handler follows the same shape:
 *   1. Read + validate the PostToolUse payload (via readPostToolUse).
 *   2. Resolve the event session context (handles subagents).
 *   3. Build tool-specific metadata + semantics.
 *   4. Post a tagged event to the monitor.
 *
 * This file centralizes the read/resolve boilerplate so each hook file
 * can focus on the tool-specific logic only.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPostToolUse, type PostToolUsePayload} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import type {RuntimeSessionEnsureResult} from "~shared/hook-runtime/transport.js";
import {isRecord, truncateOutput} from "~shared/util/utils.js";

export interface PostToolUseHandlerArgs {
    readonly payload: PostToolUsePayload;
    readonly ids: RuntimeSessionEnsureResult;
}

/**
 * Wraps the PostToolUse hook boilerplate: validates the payload, resolves
 * the (sub-)agent session context, and invokes the tool-specific handler.
 * Hook scripts should call this with their PostToolUse-matcher name and
 * a handler that builds+posts the event.
 */
export async function runPostToolUseHook(
    matcherName: string,
    handler: (args: PostToolUseHandlerArgs) => Promise<void>,
): Promise<void> {
    await runHook(`PostToolUse/${matcherName}`, {
        logger: claudeHookRuntime.logger,
        parse: readPostToolUse,
        handler: async (payload) => {
            if (!payload.sessionId || !payload.toolName) return;
            const ids = await resolveEventSessionIds(
                payload.sessionId,
                payload.agentId,
                payload.agentType,
            );
            await handler({payload, ids});
        },
    });
}

export const postTaggedEvent = claudeHookRuntime.transport.postTaggedEvent;
export const postTaggedEvents = claudeHookRuntime.transport.postTaggedEvents;

/**
 * Head+tail truncation windows for terminal tool output. Tuned to keep
 * verifier-relevant information (initial banner + final error/result) without
 * letting megabyte build logs balloon the event store.
 */
export const TERMINAL_STDOUT_HEAD = 4096;
export const TERMINAL_STDOUT_TAIL = 4096;
export const TERMINAL_STDERR_HEAD = 2048;
export const TERMINAL_STDERR_TAIL = 2048;

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

export const TOOL_RESULT_HEAD = 2048;
export const TOOL_RESULT_TAIL = 2048;

export interface CapturedToolResult {
    readonly resultText?: string;
    readonly resultBytes?: number;
    readonly resultTruncated?: boolean;
    readonly resultMatches?: number;
}

/**
 * Captures a generic tool_response body (Read/Grep/Glob/WebFetch/WebSearch).
 * Strings are truncated head+tail; objects are JSON-stringified first.
 * `matchCounter` lets the caller supply a cheap per-tool count (e.g. number
 * of result lines for Grep, length of file list for Glob).
 */
export function captureToolResultBody(
    value: unknown,
    options: {readonly matchCounter?: (raw: unknown, text: string) => number | undefined} = {},
): CapturedToolResult {
    const text = stringifyToolResult(value);
    if (text === undefined) return {};
    const matches = options.matchCounter?.(value, text);
    const trunc = truncateOutput(text, TOOL_RESULT_HEAD, TOOL_RESULT_TAIL);
    const out: Record<string, unknown> = {
        resultText: trunc.body,
        resultBytes: trunc.bytes,
    };
    if (trunc.truncated) out["resultTruncated"] = true;
    if (typeof matches === "number" && Number.isFinite(matches)) out["resultMatches"] = matches;
    return out as CapturedToolResult;
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

/**
 * Extracts stdout/stderr/exitCode/interrupted from a Claude Code Bash-family
 * tool_response. Accepts the various field name conventions Claude Code has
 * shipped (snake_case `exit_code`, `output` alias for stdout). Returns the
 * captured fields with head+tail truncation applied to the bodies, and the
 * full byte counts preserved so callers can tell what was clipped.
 */
export function captureTerminalToolResponse(value: unknown): CapturedTerminalResult {
    if (!isRecord(value)) return {};
    const result: Record<string, unknown> = {};
    const exit = value["exit_code"] ?? value["exitCode"];
    if (typeof exit === "number" && Number.isFinite(exit)) result["exitCode"] = exit;
    const interrupted = value["interrupted"] ?? value["wasInterrupted"];
    if (typeof interrupted === "boolean") result["interrupted"] = interrupted;
    const stdout = value["stdout"] ?? value["output"];
    if (typeof stdout === "string" && stdout.length > 0) {
        const trunc = truncateOutput(stdout, TERMINAL_STDOUT_HEAD, TERMINAL_STDOUT_TAIL);
        result["stdout"] = trunc.body;
        result["stdoutBytes"] = trunc.bytes;
        if (trunc.truncated) result["stdoutTruncated"] = true;
    }
    const stderr = value["stderr"];
    if (typeof stderr === "string" && stderr.length > 0) {
        const trunc = truncateOutput(stderr, TERMINAL_STDERR_HEAD, TERMINAL_STDERR_TAIL);
        result["stderr"] = trunc.body;
        result["stderrBytes"] = trunc.bytes;
        if (trunc.truncated) result["stderrTruncated"] = true;
    }
    return result as CapturedTerminalResult;
}
