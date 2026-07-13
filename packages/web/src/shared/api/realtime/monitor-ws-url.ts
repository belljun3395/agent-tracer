import { getMonitorWebSocketBaseUrl } from "~web/shared/api/monitor-endpoints.js";
import { getUserId } from "~web/shared/api/user-identity.js";

/** 실시간 연결 주소에 WS 경로와 브라우저 신원을 반영한다. */
export function getMonitorWsUrl(): string {
  const wsUrl = new URL(getMonitorWebSocketBaseUrl().replace(/^http/, "ws"));
  wsUrl.pathname = "/ws";
  const userId = getUserId();
  if (userId) wsUrl.searchParams.set("userId", userId);
  return wsUrl.toString();
}
