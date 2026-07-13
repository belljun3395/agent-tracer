import type {IncomingMessage, RequestListener, ServerResponse} from "node:http";
import {isRecord} from "~runtime/support/json.js";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {purgeDeadLetter, requeueDeadLetter} from "~runtime/config/dead.letter.js";
import {isMatchingToken, readPresentedToken, writeLoopbackCorsHeaders} from "~runtime/daemon/control/resume.http.js";
import {renderControlPage} from "~runtime/daemon/control/control.page.js";
import type {ControlSnapshot} from "~runtime/daemon/control/control.state.js";

const MAX_BODY_BYTES = 16 * 1024;
const ACTION_DELAY_MS = 50;

export const CONTROL_PAGE_PATH = "/";
export const CONTROL_API_PREFIX = "/api/v1/control/";

/** 제어 화면이 호출하는 데몬 조작 포트다. */
export interface ControlActions {
    readonly snapshot: () => ControlSnapshot;
    readonly flush: () => void;
    readonly resetBackoff: () => void;
    readonly refreshCaches: () => void;
    readonly restart: () => void;
    readonly stop: () => void;
}

export interface ControlHttpDeps {
    readonly token: string;
    readonly actions: ControlActions;
    readonly paths?: AgentTracerPaths;
}

/** 제어 화면과 그 조작 API를 루프백에만 서빙하는 HTTP 핸들러다. */
export function createControlHttpHandler(deps: ControlHttpDeps): RequestListener {
    const paths = deps.paths ?? resolveAgentTracerPaths();
    return (request, response) => {
        void route(request, response, deps, paths);
    };
}

async function route(
    request: IncomingMessage,
    response: ServerResponse,
    deps: ControlHttpDeps,
    paths: AgentTracerPaths,
): Promise<void> {
    if (!writeLoopbackCorsHeaders(request, response, "GET, POST, OPTIONS")) {
        writeJson(response, 403, error("forbidden_origin", "Forbidden origin"));
        return;
    }
    if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
    }
    const url = (request.url ?? "").split("?")[0] ?? "";

    if (request.method === "GET" && url === CONTROL_PAGE_PATH) {
        writePage(response, renderControlPage(deps.token));
        return;
    }
    if (!url.startsWith(CONTROL_API_PREFIX)) {
        writeJson(response, 404, error("not_found", "Not found"));
        return;
    }
    if (!isAuthorized(request, deps.token)) {
        writeJson(response, 401, error("invalid_token", "Control token is invalid"));
        return;
    }

    try {
        await dispatch(request, response, deps, paths, url);
    } catch (err) {
        writeJson(response, 500, error("control_failed", err instanceof Error ? err.message : "control action failed"));
    }
}

const ACTION_PATHS = new Set([
    "/api/v1/control/flush",
    "/api/v1/control/reset-backoff",
    "/api/v1/control/refresh-caches",
    "/api/v1/control/dead-letter/requeue",
    "/api/v1/control/dead-letter/purge",
    "/api/v1/control/restart",
    "/api/v1/control/stop",
]);

async function dispatch(
    request: IncomingMessage,
    response: ServerResponse,
    deps: ControlHttpDeps,
    paths: AgentTracerPaths,
    url: string,
): Promise<void> {
    const isSnapshot = url === "/api/v1/control/snapshot";
    if (!isSnapshot && !ACTION_PATHS.has(url)) {
        writeJson(response, 404, error("not_found", "Not found"));
        return;
    }
    const allowed = isSnapshot ? "GET" : "POST";
    if (request.method !== allowed) {
        writeJson(response, 405, error("method_not_allowed", "Method not allowed"));
        return;
    }
    if (isSnapshot) {
        writeJson(response, 200, {ok: true, data: deps.actions.snapshot()});
        return;
    }
    switch (url) {
        case "/api/v1/control/flush":
            deps.actions.flush();
            writeJson(response, 200, {ok: true});
            return;
        case "/api/v1/control/reset-backoff":
            deps.actions.resetBackoff();
            writeJson(response, 200, {ok: true});
            return;
        case "/api/v1/control/refresh-caches":
            deps.actions.refreshCaches();
            writeJson(response, 200, {ok: true});
            return;
        case "/api/v1/control/dead-letter/requeue": {
            const result = requeueDeadLetter(parseRequeueFilter(await readBody(request)), paths);
            deps.actions.flush();
            writeJson(response, 200, {ok: true, data: result});
            return;
        }
        case "/api/v1/control/dead-letter/purge":
            writeJson(response, 200, {ok: true, data: purgeDeadLetter(paths)});
            return;
        case "/api/v1/control/restart":
            writeJson(response, 200, {ok: true});
            defer(() => deps.actions.restart());
            return;
        case "/api/v1/control/stop":
            writeJson(response, 200, {ok: true});
            defer(() => deps.actions.stop());
            return;
        default:
            writeJson(response, 404, error("not_found", "Not found"));
    }
}

/** 응답이 브라우저에 닿은 뒤에 데몬 프로세스를 흔든다. */
function defer(action: () => void): void {
    setTimeout(action, ACTION_DELAY_MS);
}

function parseRequeueFilter(body: string): {kinds?: readonly string[]} {
    if (body.trim().length === 0) return {};
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return {};
    const kinds = parsed["kinds"];
    if (!Array.isArray(kinds)) return {};
    const selected = kinds.filter((kind): kind is string => typeof kind === "string" && kind.length > 0);
    return selected.length > 0 ? {kinds: selected} : {};
}

async function readBody(request: IncomingMessage): Promise<string> {
    let body = "";
    for await (const chunk of request) {
        body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("request body is too large");
    }
    return body;
}

function isAuthorized(request: IncomingMessage, expected: string): boolean {
    const presented = readPresentedToken(request);
    if (presented === undefined) return false;
    return isMatchingToken(presented, expected);
}

function error(code: string, message: string): unknown {
    return {ok: false, error: {code, message}};
}

function writePage(response: ServerResponse, html: string): void {
    response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-frame-options": "DENY",
        "content-security-policy":
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
        "cache-control": "no-store",
    });
    response.end(html);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {"content-type": "application/json", "cache-control": "no-store"});
    response.end(JSON.stringify(body));
}
