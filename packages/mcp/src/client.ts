/**
 * @module client
 *
 * Agent Tracer REST API HTTP 클라이언트.
 * MCP 도구 핸들러에서 서버로 이벤트를 POST할 때 사용.
 * 모든 오류는 조용히 무시하여 에이전트 동작을 방해하지 않음.
 */

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
 */
export class MonitorClient {
  /** 요청을 보낼 베이스 URL (끝 슬래시 없음). */
  readonly baseUrl: string;

  constructor(baseUrl = process.env.MONITOR_BASE_URL ?? "http://127.0.0.1:3847") {
    this.baseUrl = baseUrl.replace(/\/+$/g, "");
  }

  /**
   * 지정한 엔드포인트로 GET 요청을 보낸다.
   * 네트워크 오류나 비정상 응답 시에도 예외를 던지지 않고 `ok:false`를 반환한다.
   */
  async get(endpoint: string): Promise<SafePostResult> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      if (!response.ok) {
        return { ok: false, endpoint, status: response.status, message: `monitor server returned ${response.status}` };
      }
      return { ok: true, endpoint, status: response.status, data: (await response.json()) as unknown, message: "ok" };
    } catch {
      return { ok: false, endpoint, message: "monitor server unavailable; event ignored" };
    }
  }

  /**
   * 지정한 엔드포인트로 JSON payload를 POST한다.
   * 네트워크 오류나 비정상 응답 시에도 예외를 던지지 않고 `ok:false`를 반환한다.
   *
   * @param endpoint - `/api/task-start` 형식의 경로
   * @param payload  - JSON 직렬화 가능한 요청 본문
   * @returns        성공/실패 여부와 응답 정보를 담은 {@link SafePostResult}
   */
  async post(endpoint: string, payload: unknown): Promise<SafePostResult> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return {
          ok: false,
          endpoint,
          status: response.status,
          message: `monitor server returned ${response.status}; event ignored`
        };
      }

      return {
        ok: true,
        endpoint,
        status: response.status,
        data: (await response.json()) as unknown,
        message: "monitor event recorded"
      };
    } catch {
      return {
        ok: false,
        endpoint,
        message: "monitor server unavailable; event ignored"
      };
    }
  }
}
