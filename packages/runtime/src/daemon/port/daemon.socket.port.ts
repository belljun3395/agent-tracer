import type {GuardrailRule} from "~runtime/domain/guardrail/model/rule.model.js";
import type {GuardrailVerdict} from "~runtime/domain/guardrail/model/verdict.model.js";
import type {PreprocessingHint, PreprocessingHintsRequest} from "~runtime/domain/hint/model/hint.model.js";
import {parseMcpSocketRequest, type McpSocketRequest, type McpSocketResponse} from "~runtime/daemon/port/mcp.socket.port.js";
import {isRecord} from "~runtime/support/json.js";

/** 훅과 데몬이 유닉스 소켓으로 주고받는 개행 종결 JSON 한 줄의 계약이며 클라이언트와 서버가 같은 타입을 쓴다. */

export interface DaemonVersionRequest {
    readonly type: "version";
    readonly hookVersion?: string;
}

export interface DaemonShutdownRequest {
    readonly type: "shutdown";
    readonly reason?: string;
}

export interface DaemonHintsRequest {
    readonly type: "hints";
    readonly taskId: string;
    readonly request: PreprocessingHintsRequest;
}

/** 프롬프트 앞에서 필요한 규칙과 힌트를 한 번에 묻는다. */
export interface DaemonPromptContextRequest {
    readonly type: "prompt-context";
    readonly taskId: string;
    readonly request: PreprocessingHintsRequest;
}

export interface DaemonGuardrailRequest {
    readonly type: "guardrail";
    readonly taskId: string;
    readonly sessionId?: string;
    readonly candidateAssistantText?: string;
}

export interface DaemonDeliveryRequest {
    readonly type: "delivery";
}

export type DaemonRequest =
    | DaemonVersionRequest
    | DaemonShutdownRequest
    | DaemonHintsRequest
    | DaemonPromptContextRequest
    | DaemonGuardrailRequest
    | DaemonDeliveryRequest
    | McpSocketRequest;

export interface DaemonVersionResponse {
    readonly version: string;
    readonly pid?: number;
}

export interface DaemonAckResponse {
    readonly ok: true;
}

export interface DaemonHintsResponse {
    readonly hints: readonly PreprocessingHint[];
}

export interface DaemonPromptContextResponse {
    readonly rules: readonly GuardrailRule[];
    readonly hints: readonly PreprocessingHint[];
}

export interface DaemonGuardrailResponse {
    readonly verdicts: readonly GuardrailVerdict[];
}

/** 스풀이 서버로 빠져나가고 있는지와 지금 쌓여 있는 양이다. */
export interface DaemonDeliveryResponse {
    readonly reachable: boolean;
    readonly baseUrl: string;
    readonly backlogBytes: number;
}

export type DaemonResponse =
    | DaemonVersionResponse
    | DaemonAckResponse
    | DaemonHintsResponse
    | DaemonPromptContextResponse
    | DaemonGuardrailResponse
    | DaemonDeliveryResponse
    | McpSocketResponse;

export function parseDaemonRequest(value: unknown): DaemonRequest | null {
    if (!isRecord(value) || typeof value["type"] !== "string") return null;
    switch (value["type"]) {
        case "version":
            return {
                type: "version",
                ...(typeof value["hookVersion"] === "string" ? {hookVersion: value["hookVersion"]} : {}),
            };
        case "shutdown":
            return {
                type: "shutdown",
                ...(typeof value["reason"] === "string" ? {reason: value["reason"]} : {}),
            };
        case "hints":
            return typeof value["taskId"] === "string" && isRecord(value["request"])
                ? {
                    type: "hints",
                    taskId: value["taskId"],
                    request: value["request"] as unknown as PreprocessingHintsRequest,
                }
                : null;
        case "delivery":
            return {type: "delivery"};
        case "prompt-context":
            return typeof value["taskId"] === "string" && isRecord(value["request"])
                ? {
                    type: "prompt-context",
                    taskId: value["taskId"],
                    request: value["request"] as unknown as PreprocessingHintsRequest,
                }
                : null;
        case "guardrail":
            return typeof value["taskId"] === "string"
                ? {
                    type: "guardrail",
                    taskId: value["taskId"],
                    ...(typeof value["sessionId"] === "string" ? {sessionId: value["sessionId"]} : {}),
                    ...(typeof value["candidateAssistantText"] === "string"
                        ? {candidateAssistantText: value["candidateAssistantText"]}
                        : {}),
                }
                : null;
        default:
            return parseMcpSocketRequest(value["type"], value);
    }
}

export function parseDaemonVersionResponse(value: unknown): DaemonVersionResponse | null {
    if (!isRecord(value) || typeof value["version"] !== "string") return null;
    return {
        version: value["version"],
        ...(typeof value["pid"] === "number" ? {pid: value["pid"]} : {}),
    };
}

export function isDaemonAckResponse(value: unknown): value is DaemonAckResponse {
    return isRecord(value) && value["ok"] === true;
}

export function parseDaemonHintsResponse(value: unknown): DaemonHintsResponse | null {
    return isRecord(value) && Array.isArray(value["hints"])
        ? {hints: value["hints"] as PreprocessingHint[]}
        : null;
}

export function parseDaemonPromptContextResponse(value: unknown): DaemonPromptContextResponse | null {
    if (!isRecord(value) || !Array.isArray(value["rules"]) || !Array.isArray(value["hints"])) return null;
    return {rules: value["rules"] as GuardrailRule[], hints: value["hints"] as PreprocessingHint[]};
}

export function parseDaemonGuardrailResponse(value: unknown): DaemonGuardrailResponse | null {
    return isRecord(value) && Array.isArray(value["verdicts"])
        ? {verdicts: value["verdicts"] as GuardrailVerdict[]}
        : null;
}

export function parseDaemonDeliveryResponse(value: unknown): DaemonDeliveryResponse | null {
    if (!isRecord(value) || typeof value["reachable"] !== "boolean") return null;
    return {
        reachable: value["reachable"],
        baseUrl: typeof value["baseUrl"] === "string" ? value["baseUrl"] : "",
        backlogBytes: typeof value["backlogBytes"] === "number" ? value["backlogBytes"] : 0,
    };
}
