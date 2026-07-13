import type {IncomingMessage, RequestListener, ServerResponse} from "node:http";
import {timingSafeEqual} from "node:crypto";
import {isRecord} from "~runtime/support/json.js";
import {
    launchResumeInTerminal,
    ResumeLaunchError,
    type ResumeLaunchRequest,
    type ResumeLaunchResult,
} from "~runtime/daemon/control/resume.command.js";

const MAX_BODY_BYTES = 8 * 1024;
const RESUME_PATH = "/api/v1/resume";

export const RESUME_TOKEN_HEADER = "x-agent-tracer-resume-token";

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

export function isAllowedResumeOrigin(origin: string | undefined): boolean {
    if (origin === undefined) return true;
    try {
        const url = new URL(origin);
        return url.protocol === "http:" && (
            url.hostname === "127.0.0.1"
            || url.hostname === "localhost"
            || url.hostname === "::1"
            || url.hostname === "[::1]"
        );
    } catch {
        return false;
    }
}

/** 루프백 origin에만 CORS를 열고 그 밖의 요청은 거절한다. */
export function writeLoopbackCorsHeaders(
    request: IncomingMessage,
    response: ServerResponse,
    methods: string,
): boolean {
    const origin = request.headers.origin;
    if (!isAllowedResumeOrigin(origin)) return false;
    if (origin !== undefined) {
        response.setHeader("access-control-allow-origin", origin);
        response.setHeader("vary", "origin");
    }
    response.setHeader("access-control-allow-methods", methods);
    response.setHeader("access-control-allow-headers", `content-type, ${RESUME_TOKEN_HEADER}`);
    return true;
}

/** 제시된 토큰을 길이 노출 없이 기대값과 비교한다. */
export function isMatchingToken(presented: string, expected: string): boolean {
    const presentedBuf = Buffer.from(presented);
    const expectedBuf = Buffer.from(expected);
    if (presentedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(presentedBuf, expectedBuf);
}

export function readPresentedToken(request: IncomingMessage): string | undefined {
    const header = request.headers[RESUME_TOKEN_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    return value !== undefined && value.length > 0 ? value : undefined;
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
        const body = parseResumeRequest(JSON.parse(await readBody(request)));
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

async function readBody(request: IncomingMessage): Promise<string> {
    let body = "";
    for await (const chunk of request) {
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
            throw new ResumeLaunchError("request body is too large", "invalid_request", 413);
        }
    }
    return body;
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

function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {"content-type": "application/json"});
    response.end(JSON.stringify(body));
}
