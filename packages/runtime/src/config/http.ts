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

/** 봉투(`{data: ...}`)에서 데이터를 꺼내며 실패 응답은 null로 취급한다. */
export async function getJson<T>(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
    const response = await fetch(url, {headers, signal: AbortSignal.timeout(timeoutMs)});
    if (!response.ok) return null;
    const parsed: unknown = await response.json();
    return isRecord(parsed) ? (parsed as T) : null;
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
        signal: AbortSignal.timeout(timeoutMs),
    });
}
