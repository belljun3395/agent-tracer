import {isRecord} from "~runtime/support/json.js";

const DEFAULT_TIMEOUT_MS = 5000;

/** 모니터 API 호출에 공통으로 필요한 연결 정보다. */
export interface MonitorHttpRequest {
    readonly baseUrl: string;
    readonly headers: Record<string, string>;
    readonly signal?: AbortSignal;
}

export function jsonHeaders(headers: Record<string, string>): Record<string, string> {
    return {...headers, "Content-Type": "application/json"};
}

export function resolveTimeoutSignal(timeoutMs: number = DEFAULT_TIMEOUT_MS, signal?: AbortSignal): AbortSignal {
    return signal ?? AbortSignal.timeout(timeoutMs);
}

/** 서버에게 물은 결과이며 `found`는 응답값, `absent`는 서버의 확답(404), `unavailable`은 확답을 못 받음(그 외 상태·타임아웃·네트워크 실패)이다. */
export type Fetched<T> =
    | {readonly kind: "found"; readonly value: T}
    | {readonly kind: "absent"}
    | {readonly kind: "unavailable"};

/** 봉투(`{data: ...}`)에서 데이터를 꺼내며 응답 확답과 못 받음을 구분해 낸다. */
export async function getJson<T>(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Fetched<T>> {
    let response: Response;
    try {
        response = await fetch(url, {headers, signal: resolveTimeoutSignal(timeoutMs)});
    } catch {
        return {kind: "unavailable"};
    }
    if (response.status === 404) return {kind: "absent"};
    if (!response.ok) return {kind: "unavailable"};
    try {
        const parsed: unknown = await response.json();
        return isRecord(parsed) ? {kind: "found", value: parsed as T} : {kind: "unavailable"};
    } catch {
        return {kind: "unavailable"};
    }
}

export async function postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: jsonHeaders(headers),
        body: JSON.stringify(body),
        signal: resolveTimeoutSignal(timeoutMs),
    });
}

export async function patchJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
    return fetch(url, {
        method: "PATCH",
        headers: jsonHeaders(headers),
        body: JSON.stringify(body),
        signal: resolveTimeoutSignal(timeoutMs),
    });
}
