import * as path from "node:path";
import {isClaudeRuntimeSource} from "@monitor/kernel/ingest/runtime.source.const.js";

/** 대시보드가 고른 세션을 터미널에서 다시 열기 위한 요청이다. */
export interface ResumeCommandRequest {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly workspacePath?: string;
}

export type ResumeCommandErrorCode = "invalid_request" | "unsupported_runtime";

/** 재개 명령을 만들 수 없는 요청이며 데몬이 이 코드를 응답으로 옮긴다. */
export class ResumeCommandError extends Error {
    constructor(message: string, readonly code: ResumeCommandErrorCode) {
        super(message);
    }
}

/** 런타임 세션을 워크스페이스에서 재개하는 쉘 명령을 조립한다. */
export function buildResumeShellCommand(request: ResumeCommandRequest): string {
    const invocation = buildInvocation(
        request.runtimeSource,
        normalizeRequired("runtimeSessionId", request.runtimeSessionId),
    );
    const workspacePath = normalizeWorkspacePath(request.workspacePath);
    return workspacePath ? `cd ${shellQuote(workspacePath)} && ${invocation}` : invocation;
}

/** 쉘 명령을 macOS Terminal이 실행할 AppleScript로 감싼다. */
export function buildTerminalAppleScript(shellCommand: string): string {
    return [
        'tell application "Terminal"',
        "activate",
        `do script ${appleScriptString(shellCommand)}`,
        "end tell",
    ].join("\n");
}

function buildInvocation(runtimeSource: string, runtimeSessionId: string): string {
    if (!isClaudeRuntimeSource(runtimeSource)) {
        throw new ResumeCommandError(`unsupported runtimeSource: ${runtimeSource}`, "unsupported_runtime");
    }
    return `claude --resume ${shellQuote(runtimeSessionId)}`;
}

function normalizeRequired(field: string, value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0 || hasControlCharacter(trimmed)) {
        throw new ResumeCommandError(`${field} is invalid`, "invalid_request");
    }
    return trimmed;
}

function normalizeWorkspacePath(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    if (hasControlCharacter(trimmed) || !path.isAbsolute(trimmed)) {
        throw new ResumeCommandError("workspacePath is invalid", "invalid_request");
    }
    return trimmed;
}

function hasControlCharacter(value: string): boolean {
    return value.includes("\0") || /[\r\n]/.test(value);
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
}

function appleScriptString(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
