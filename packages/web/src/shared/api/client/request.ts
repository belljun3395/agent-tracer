import { getMonitorApiBaseUrl } from "~web/shared/api/monitor-endpoints.js";
import { getUserId } from "~web/shared/api/user-identity.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export function createRequestSignal(options?: RequestOptions): {
  readonly signal: AbortSignal | null;
  readonly cleanup: () => void;
} {
  const externalSignal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!externalSignal && timeoutMs <= 0) {
    return { signal: null, cleanup: () => undefined };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const abortFromExternal = (): void => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(
        new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError"),
      );
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
    },
  };
}

/** 공통 신원·쿠키·취소 규약을 적용해 모니터 HTTP 요청을 보낸다. */
export async function request(
  pathname: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<Response> {
  const { signal, cleanup } = createRequestSignal(options);
  const headers = new Headers(init?.headers);
  const userId = getUserId();
  if (userId) headers.set("x-monitor-user", userId);
  const requestInit: RequestInit = {
    credentials: "include",
    ...init,
    headers,
    ...(signal ? { signal } : {}),
  };
  try {
    return await fetch(`${getMonitorApiBaseUrl()}${pathname}`, requestInit);
  } catch (error) {
    if (
      signal?.aborted &&
      signal.reason instanceof DOMException &&
      signal.reason.name === "TimeoutError"
    ) {
      throw new Error(`Request timed out for ${pathname}`);
    }
    throw error;
  } finally {
    cleanup();
  }
}
