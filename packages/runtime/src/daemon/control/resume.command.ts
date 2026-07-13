import {spawn as spawnProcess, type SpawnOptions} from "node:child_process";
import {
    buildResumeShellCommand,
    buildTerminalAppleScript,
    ResumeCommandError,
    type ResumeCommandRequest,
} from "~runtime/domain/session/model/resume.command.model.js";

const OSASCRIPT_PATH = "/usr/bin/osascript";

/** 대시보드가 요청하는 세션 재개의 대상이다. */
export interface ResumeLaunchRequest extends ResumeCommandRequest {
    readonly taskId?: string;
}

export interface ResumeLaunchResult {
    readonly command: string;
}

export interface SpawnedProcess {
    once(event: "error", listener: (error: Error) => void): this;
    once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export type SpawnFn = (
    command: string,
    args: readonly string[],
    options: SpawnOptions,
) => SpawnedProcess;

export interface LaunchResumeOptions {
    readonly platform?: NodeJS.Platform;
    readonly spawn?: SpawnFn;
}

export type ResumeLaunchErrorCode =
    | "invalid_request"
    | "unsupported_runtime"
    | "unsupported_platform"
    | "launch_failed";

/** 재개 실패의 사유와 HTTP 응답 코드를 함께 나르는 오류다. */
export class ResumeLaunchError extends Error {
    constructor(
        message: string,
        readonly code: ResumeLaunchErrorCode,
        readonly status: number,
    ) {
        super(message);
    }
}

/** macOS Terminal 새 창에서 세션 재개 명령을 실행한다. */
export async function launchResumeInTerminal(
    request: ResumeLaunchRequest,
    options: LaunchResumeOptions = {},
): Promise<ResumeLaunchResult> {
    const command = resolveCommand(request);
    const platform = options.platform ?? process.platform;
    if (platform !== "darwin") {
        throw new ResumeLaunchError("resume helper supports macOS Terminal only", "unsupported_platform", 501);
    }
    await runProcess(options.spawn ?? spawnProcess, OSASCRIPT_PATH, ["-e", buildTerminalAppleScript(command)]);
    return {command};
}

function resolveCommand(request: ResumeLaunchRequest): string {
    try {
        return buildResumeShellCommand(request);
    } catch (error) {
        if (error instanceof ResumeCommandError) {
            throw new ResumeLaunchError(error.message, error.code, 400);
        }
        throw error;
    }
}

function runProcess(spawn: SpawnFn, command: string, args: readonly string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {detached: true, stdio: "ignore"});
        child.once("error", (error) => {
            reject(new ResumeLaunchError(error.message, "launch_failed", 500));
        });
        child.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new ResumeLaunchError(
                `osascript exited with ${code ?? signal ?? "unknown"}`,
                "launch_failed",
                500,
            ));
        });
    });
}
