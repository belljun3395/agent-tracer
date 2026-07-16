import type {IncomingMessage, RequestListener, ServerResponse} from "node:http";
import {resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import {validateDaemonSettingsInput} from "~runtime/config/daemon.settings.js";
import {isRecord} from "~runtime/support/json.js";
import {
    isAuthorized,
    readBody,
    writeJson,
    writeLoopbackCorsHeaders,
} from "~runtime/daemon/control/loopback.http.js";
import {
    findControlAction,
    type ConfigUpdateInput,
    type ControlActions,
} from "~runtime/daemon/control/control.actions.js";
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

/** 카탈로그 밖 폼 값이며 http 계층만 검증을 안다 — 액션은 검증이 끝난 값만 받는다. */
function validateConfigInput(
    raw: unknown,
): {ok: true; value: ConfigUpdateInput} | {ok: false; errors: Record<string, string>} {
    const record = isRecord(raw) ? raw : {};
    const errors: Record<string, string> = {};
    const userId = typeof record["userId"] === "string" ? record["userId"].trim() : "";
    if (!userId) errors["userId"] = "userId is required";
    const baseUrl = typeof record["baseUrl"] === "string" ? record["baseUrl"].trim() : "";
    if (!baseUrl) errors["baseUrl"] = "baseUrl is required";
    const daemonResult = validateDaemonSettingsInput(record["daemon"]);
    if (!daemonResult.ok) Object.assign(errors, daemonResult.errors);
    if (Object.keys(errors).length > 0 || !daemonResult.ok) return {ok: false, errors};
    return {ok: true, value: {userId, baseUrl, daemon: daemonResult.value}};
}

/** 스냅샷 조회와 카탈로그 액션을 키 하나로 라우팅하며 알려진 키의 집합은 카탈로그가 정한다.
 * `config`는 카탈로그 밖 전용 분기다 — 검증 실패가 있는 액션이라 자동 버튼 렌더에서 뺀다. */
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
    if (key === "config") {
        if (request.method !== "POST") {
            writeJson(response, 405, error("method_not_allowed", "Method not allowed"));
            return;
        }
        const body = await readBody(request, MAX_BODY_BYTES);
        let parsed: unknown;
        try {
            parsed = body.trim().length > 0 ? JSON.parse(body) : {};
        } catch {
            writeJson(response, 400, {ok: false, errors: {body: "body must be valid JSON"}});
            return;
        }
        const validated = validateConfigInput(parsed);
        if (!validated.ok) {
            writeJson(response, 400, {ok: false, errors: validated.errors});
            return;
        }
        writeJson(response, 200, {ok: true, data: deps.actions.updateConfig(validated.value)});
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
