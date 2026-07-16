import type {IncomingMessage, ServerResponse} from "node:http";
import {timingSafeEqual} from "node:crypto";

/** 제어 화면과 재개 실행이 공유하는 루프백 전용 토큰 헤더다. */
export const CONTROL_TOKEN_HEADER = "x-agent-tracer-resume-token";

export function isAllowedLoopbackOrigin(origin: string | undefined): boolean {
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

/** 루프백 origin에만 CORS를 여는 보안 게이트다. */
export function writeLoopbackCorsHeaders(
    request: IncomingMessage,
    response: ServerResponse,
    methods: string,
): boolean {
    const origin = request.headers.origin;
    if (!isAllowedLoopbackOrigin(origin)) return false;
    if (origin !== undefined) {
        response.setHeader("access-control-allow-origin", origin);
        response.setHeader("vary", "origin");
    }
    response.setHeader("access-control-allow-methods", methods);
    response.setHeader("access-control-allow-headers", `content-type, ${CONTROL_TOKEN_HEADER}`);
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
    const header = request.headers[CONTROL_TOKEN_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    return value !== undefined && value.length > 0 ? value : undefined;
}

export function isAuthorized(request: IncomingMessage, expected: string): boolean {
    const presented = readPresentedToken(request);
    if (presented === undefined) return false;
    return isMatchingToken(presented, expected);
}

/** 요청 본문을 바이트 상한까지만 읽으며, 상한을 넘으면 거절한다. */
export async function readBody(
    request: IncomingMessage,
    maxBytes: number,
    onTooLarge: () => Error = () => new Error("request body is too large"),
): Promise<string> {
    let body = "";
    for await (const chunk of request) {
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (Buffer.byteLength(body, "utf8") > maxBytes) throw onTooLarge();
    }
    return body;
}

export function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {"content-type": "application/json", "cache-control": "no-store"});
    response.end(JSON.stringify(body));
}
