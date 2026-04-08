/**
 * @module client
 *
 * Agent Tracer REST API HTTP 클라이언트.
 * MCP 도구 핸들러에서 서버로 이벤트를 POST할 때 사용.
 * 모든 오류는 조용히 무시하여 에이전트 동작을 방해하지 않음.
 */

/** Per-request fetch timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 5000;

/** Maximum number of retry attempts for transient failures. */
const MAX_RETRIES = 3;

/** Exponential backoff delays (ms) between successive retry attempts. */
const RETRY_DELAYS_MS: readonly [number, number, number] = [200, 400, 800];

/**
 * Typed error thrown internally by the retry logic.
 * Caught at the `get`/`post` boundary and converted to a {@link SafePostResult}.
 */
export class McpClientError extends Error {
  readonly code: "TIMEOUT" | "NETWORK" | "HTTP";
  readonly statusCode?: number;

  constructor(code: "TIMEOUT" | "NETWORK" | "HTTP", message: string, statusCode?: number) {
    super(message);
    this.name = "McpClientError";
    this.code = code;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
  }
}

/**
 * Returns true when the given status code should NOT trigger a retry.
 * 4xx responses are client errors and are not retryable.
 */
function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Pause execution for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with up to `MAX_RETRIES` attempts using exponential backoff.
 * Only retries when `fn` throws a {@link McpClientError} with code `TIMEOUT`
 * or `NETWORK`.  HTTP errors with 4xx status are not retried.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Do not retry client (4xx) errors or non-McpClientError throws.
      if (err instanceof McpClientError && err.code === "HTTP") {
        throw err;
      }
      // No delay after the final attempt.
      const delayMs = RETRY_DELAYS_MS[attempt];
      if (attempt < MAX_RETRIES && delayMs !== undefined) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

/**
 * `MonitorClient.post` 메서드의 반환 타입.
 * 네트워크 성공/실패 여부, HTTP 상태코드, 응답 데이터, 메시지를 포함한다.
 */
export interface SafePostResult {
  readonly [key: string]: unknown;
  readonly ok: boolean;
  readonly endpoint: string;
  readonly status?: number;
  readonly data?: unknown;
  readonly message: string;
}

/**
 * Agent Tracer 서버에 이벤트를 POST하는 HTTP 클라이언트.
 * 모든 오류(네트워크 오류, 4xx/5xx 응답)는 예외를 던지지 않고 `ok:false`로 반환한다.
 * 5xx 응답 및 네트워크 오류는 최대 3회 지수 백오프 재시도 후 포기한다.
 */
export class MonitorClient {
  /** 요청을 보낼 베이스 URL (끝 슬래시 없음). */
  readonly baseUrl: string;

  constructor(baseUrl = process.env.MONITOR_BASE_URL ?? "http://127.0.0.1:3847") {
    this.baseUrl = baseUrl.replace(/\/+$/g, "");
  }

  /**
   * 지정한 엔드포인트로 HTTP 요청을 보낸다 (GET, POST).
   * 공통된 에러 처리 및 재시도 로직을 담당한다.
   * 네트워크 오류나 비정상 응답 시에도 예외를 던지지 않고 `ok:false`를 반환한다.
   * 5xx 응답과 네트워크/타임아웃 오류는 지수 백오프로 재시도한다.
   *
   * @param method   - HTTP 메서드 ("GET" 또는 "POST")
   * @param endpoint - 요청 경로
   * @param payload  - POST 요청의 JSON 본문 (GET에는 사용 안 함)
   * @returns        성공/실패 여부와 응답 정보를 담은 {@link SafePostResult}
   */
  private async request(
    method: "GET" | "POST",
    endpoint: string,
    payload?: unknown
  ): Promise<SafePostResult> {
    try {
      return await withRetry(async () => {
        let response: Response;
        try {
          const options: RequestInit = {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            ...(method === "POST" ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            } : {}),
          };
          response = await fetch(`${this.baseUrl}${endpoint}`, options);
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError") {
            throw new McpClientError("TIMEOUT", `request timed out after ${FETCH_TIMEOUT_MS}ms`);
          }
          throw new McpClientError("NETWORK", "monitor server unavailable");
        }

        if (!response.ok) {
          if (isClientError(response.status)) {
            // 4xx: convert to HTTP error, will not be retried.
            throw new McpClientError("HTTP", `monitor server returned ${response.status}`, response.status);
          }
          // 5xx: throw retryable network-class error.
          throw new McpClientError("NETWORK", `monitor server returned ${response.status}`, response.status);
        }

        return {
          ok: true,
          endpoint,
          status: response.status,
          data: (await response.json()) as unknown,
          message: method === "POST" ? "monitor event recorded" : "ok",
        };
      });
    } catch (err) {
      if (err instanceof McpClientError) {
        return {
          ok: false,
          endpoint,
          ...(err.statusCode !== undefined ? { status: err.statusCode } : {}),
          message: err.code === "TIMEOUT"
            ? `monitor server timed out; event ignored`
            : err.code === "HTTP"
            ? `monitor server returned ${err.statusCode}; event ignored`
            : "monitor server unavailable; event ignored"
        };
      }
      return { ok: false, endpoint, message: "monitor server unavailable; event ignored" };
    }
  }

  /**
   * 지정한 엔드포인트로 GET 요청을 보낸다.
   * 네트워크 오류나 비정상 응답 시에도 예외를 던지지 않고 `ok:false`를 반환한다.
   * 5xx 응답과 네트워크/타임아웃 오류는 지수 백오프로 재시도한다.
   */
  async get(endpoint: string): Promise<SafePostResult> {
    return this.request("GET", endpoint);
  }

  /**
   * 지정한 엔드포인트로 JSON payload를 POST한다.
   * 네트워크 오류나 비정상 응답 시에도 예외를 던지지 않고 `ok:false`를 반환한다.
   * 5xx 응답과 네트워크/타임아웃 오류는 지수 백오프로 재시도한다.
   *
   * @param endpoint - `/api/task-start` 형식의 경로
   * @param payload  - JSON 직렬화 가능한 요청 본문
   * @returns        성공/실패 여부와 응답 정보를 담은 {@link SafePostResult}
   */
  async post(endpoint: string, payload: unknown): Promise<SafePostResult> {
    return this.request("POST", endpoint, payload);
  }
}
