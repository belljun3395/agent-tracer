/** 데몬 스풀 전송의 최종 상태다. */
export type SendOutcome = "ok" | "dead" | "server-error" | "retry" | "unreachable";

/** 인제스트 응답 상태코드를 재시도 정책으로 분류한 결과다. */
export type IngestStatusClass = "ok" | "dead" | "retry" | "server-error";

/** 재시도해도 결과가 같아 dead-letter로 보내는 응답 상태코드다. */
export const DEAD_LETTER_STATUSES: ReadonlySet<number> = new Set([400, 413, 422]);

export const MAX_INGEST_BACKOFF_MS = 60_000;

export function classifyIngestStatus(status: number): IngestStatusClass {
    if (status >= 200 && status < 300) return "ok";
    if (DEAD_LETTER_STATUSES.has(status)) return "dead";
    if (status >= 400 && status < 500) return "retry";
    return "server-error";
}

/** HTTP Retry-After 헤더는 초 정수이거나 HTTP 날짜이며 상한을 넘지 않는 밀리초로 해석한다. */
export function parseRetryAfterMs(header: string | null, maxMs: number): number | null {
    if (header === null) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, maxMs);
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) return Math.max(0, Math.min(dateMs - Date.now(), maxMs));
    return null;
}
