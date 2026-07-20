import {isRecord} from "~runtime/support/json.js";

/** MCP 브리지가 데몬에 위임하는 도구 호출 전용 소켓 메시지이며 daemon.socket.port가 이 계약을 얹어 쓴다. */

/** MCP set_task_title 도구가 보내는 재제목 요청이며 데몬이 sessionId로 바인딩을 정확히 찾는다. */
export interface DaemonSetTaskTitleRequest {
    readonly type: "set-task-title";
    readonly title: string;
    readonly sessionId: string;
}

export type McpSocketRequest = DaemonSetTaskTitleRequest;

/** 세션의 바인딩을 못 찾았거나 서버가 거절하면 ok가 false이고 reason에 이유가 담긴다. */
export interface DaemonSetTaskTitleResponse {
    readonly ok: boolean;
    readonly reason?: string;
}

export type McpSocketResponse = DaemonSetTaskTitleResponse;

/** daemon.socket.port의 parseDaemonRequest가 자기 타입을 못 찾을 때 넘기는 자리다. */
export function parseMcpSocketRequest(type: string, value: Record<string, unknown>): McpSocketRequest | null {
    switch (type) {
        case "set-task-title":
            return typeof value["title"] === "string" && typeof value["sessionId"] === "string"
                ? {type: "set-task-title", title: value["title"], sessionId: value["sessionId"]}
                : null;
        default:
            return null;
    }
}

export function parseDaemonSetTaskTitleResponse(value: unknown): DaemonSetTaskTitleResponse | null {
    if (!isRecord(value) || typeof value["ok"] !== "boolean") return null;
    return {
        ok: value["ok"],
        ...(typeof value["reason"] === "string" ? {reason: value["reason"]} : {}),
    };
}
