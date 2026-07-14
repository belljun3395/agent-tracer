const DEFAULT_DAEMON_BASE_URL = "http://127.0.0.1:3848";

/** 데몬이 루프백에만 서빙하므로 브라우저가 데몬과 같은 기계에 있을 때만 닿는 베이스 URL이다. */
export function resolveDaemonBaseUrl(): string {
  const configured = import.meta.env.VITE_AGENT_TRACER_RESUME_BASE_URL as string | undefined;
  return normalizeBaseUrl(configured?.trim() || DEFAULT_DAEMON_BASE_URL);
}

/** 데몬이 스스로 렌더하는 제어 화면의 주소다. */
export function resolveDaemonControlPageUrl(): string {
  return `${resolveDaemonBaseUrl()}/`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/g, "");
}
