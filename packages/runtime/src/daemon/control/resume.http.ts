import type {IncomingMessage, RequestListener, ServerResponse} from "node:http";
import {isRecord} from "~runtime/support/json.js";
import {
    isMatchingToken,
    readBody,
    readPresentedToken,
    writeJson,
    writeLoopbackCorsHeaders,
} from "~runtime/daemon/control/loopback.http.js";
import {
    launchResumeInTerminal,
    ResumeLaunchError,
    type ResumeLaunchRequest,
    type ResumeLaunchResult,
} from "~runtime/daemon/control/resume.command.js";

const MAX_BODY_BYTES = 8 * 1024;

/** 훅과 제어 화면이 재개 실행을 두드리는 단일 경로이며 라우팅도 이 리터럴에서 파생한다. */
export const RESUME_PATH = "/api/v1/resume";

export type ResumeLauncher = (request: ResumeLaunchRequest) => Promise<ResumeLaunchResult>;

/** 0600 토큰 파일을 읽을 수 있는 같은 사용자의 로컬 호출만 재개 실행을 허용하는 HTTP 핸들러다. */
export function createResumeHttpHandler(
    expectedToken: string,
    launcher: ResumeLauncher = launchResumeInTerminal,
): RequestListener {
    return (request, response) => {
        void handleResumeHttpRequest(request, response, launcher, expectedToken);
    };
}

async function handleResumeHttpRequest(
    request: IncomingMessage,
    response: ServerResponse,
    launcher: ResumeLauncher,
    expectedToken: string,
): Promise<void> {
    if (!writeLoopbackCorsHeaders(request, response, "POST, OPTIONS")) {
        writeJson(response, 403, {ok: false, error: {code: "forbidden_origin", message: "Forbidden origin"}});
        return;
    }
    if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
    }
    if (request.method !== "POST" || request.url !== RESUME_PATH) {
        writeJson(response, 404, {ok: false, error: {code: "not_found", message: "Not found"}});
        return;
    }
    const presentedToken = readPresentedToken(request);
    if (presentedToken === undefined) {
        writeJson(response, 401, {ok: false, error: {code: "missing_token", message: "Resume token is required"}});
        return;
    }
    if (!isMatchingToken(presentedToken, expectedToken)) {
        writeJson(response, 401, {ok: false, error: {code: "invalid_token", message: "Resume token is invalid"}});
        return;
    }

    try {
        const body = parseResumeRequest(JSON.parse(await readResumeBody(request)));
        const result = await launcher(body);
        writeJson(response, 200, {ok: true, command: result.command});
    } catch (error) {
        const normalized = normalizeError(error);
        writeJson(response, normalized.status, {
            ok: false,
            error: {code: normalized.code, message: normalized.message},
        });
    }
}

function readResumeBody(request: IncomingMessage): Promise<string> {
    return readBody(
        request,
        MAX_BODY_BYTES,
        () => new ResumeLaunchError("request body is too large", "invalid_request", 413),
    );
}

function parseResumeRequest(value: unknown): ResumeLaunchRequest {
    if (!isRecord(value)) throw new ResumeLaunchError("request body is invalid", "invalid_request", 400);
    const runtimeSource = readString(value, "runtimeSource");
    const runtimeSessionId = readString(value, "runtimeSessionId");
    if (runtimeSource === undefined || runtimeSessionId === undefined) {
        throw new ResumeLaunchError("runtimeSource and runtimeSessionId are required", "invalid_request", 400);
    }
    const taskId = readString(value, "taskId");
    const workspacePath = readString(value, "workspacePath");
    return {
        runtimeSource,
        runtimeSessionId,
        ...(taskId !== undefined ? {taskId} : {}),
        ...(workspacePath !== undefined ? {workspacePath} : {}),
    };
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeError(error: unknown): ResumeLaunchError {
    if (error instanceof ResumeLaunchError) return error;
    if (error instanceof SyntaxError) {
        return new ResumeLaunchError("request body is not valid JSON", "invalid_request", 400);
    }
    return new ResumeLaunchError(
        error instanceof Error ? error.message : "resume launch failed",
        "launch_failed",
        500,
    );
}
