function normalizeBaseUrl(value: string | undefined): string {
  return value?.replace(/\/+$/g, "") ?? "";
}

const apiBaseUrl = normalizeBaseUrl(
  (import.meta.env.VITE_MONITOR_BASE_URL as string | undefined) ??
    (import.meta.env.DEV
      ? (import.meta.env.VITE_MONITOR_DEV_BASE_URL as string | undefined)
      : undefined),
);

const webSocketBaseUrl = normalizeBaseUrl(
  (import.meta.env.VITE_MONITOR_WS_BASE_URL as string | undefined) ??
    (import.meta.env.DEV
      ? (import.meta.env.VITE_MONITOR_DEV_WS_BASE_URL as string | undefined)
      : undefined),
);

/** 모니터 HTTP 요청의 기준 주소를 제공한다. */
export function getMonitorApiBaseUrl(): string {
  return apiBaseUrl;
}

/** 명시적 WS 주소, HTTP 주소, 현재 origin 순서로 실시간 연결 주소를 선택한다. */
export function getMonitorWebSocketBaseUrl(): string {
  if (webSocketBaseUrl) return webSocketBaseUrl;
  if (apiBaseUrl) return apiBaseUrl;
  return window.location.origin;
}
