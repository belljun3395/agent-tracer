import type {IncomingMessage, RequestListener, ServerResponse} from "node:http";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {
    isAuthorized,
    readBody,
    writeJson,
    writeLoopbackCorsHeaders,
} from "~runtime/daemon/control/loopback.http.js";
import {findControlAction, type ControlActions} from "~runtime/daemon/control/control.actions.js";
import {renderControlPage} from "~runtime/daemon/control/control.page.js";

const MAX_BODY_BYTES = 16 * 1024;
const ACTION_DELAY_MS = 50;

export const CONTROL_PAGE_PATH = "/";
export const CONTROL_API_PREFIX = "/api/v1/control/";

export type {ControlActions} from "~runtime/daemon/control/control.actions.js";

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

/** 스냅샷 조회와 카탈로그 액션을 키 하나로 라우팅하며 알려진 키의 집합은 카탈로그가 정한다. */
async function dispatch(
    request: IncomingMessage,
    response: ServerResponse,
    deps: ControlHttpDeps,
    paths: AgentTracerPaths,
    url: string,
): Promise<void> {
    const key = url.slice(CONTROL_API_PREFIX.length);
    if (key === "snapshot") {
        if (request.method !== "GET") {
            writeJson(response, 405, error("method_not_allowed", "Method not allowed"));
            return;
        }
        writeJson(response, 200, {ok: true, data: deps.actions.snapshot()});
        return;
    }
    const action = findControlAction(key);
    if (action === undefined) {
        writeJson(response, 404, error("not_found", "Not found"));
        return;
    }
    if (request.method !== "POST") {
        writeJson(response, 405, error("method_not_allowed", "Method not allowed"));
        return;
    }
    writeJson(response, 200, await action.run({
        actions: deps.actions,
        paths,
        readBody: () => readBody(request, MAX_BODY_BYTES),
        defer,
    }));
}

/** 응답이 브라우저에 닿은 뒤에 데몬 프로세스를 흔든다. */
function defer(action: () => void): void {
    setTimeout(action, ACTION_DELAY_MS);
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
