/**
 * @module nestjs/ws/event-broadcaster.gateway
 *
 * NestJS WebSocket Gateway stub — 실제 WS 처리는 bootstrap에서
 * 기존 EventBroadcaster + ws.WebSocketServer를 직접 사용한다.
 * 이 파일은 향후 @nestjs/websockets 로 완전 마이그레이션할 때의 진입점이다.
 */

/**
 * The WebSocket upgrade handling is done in the NestJS bootstrap entry point
 * (nestjs/main.ts) by attaching the existing EventBroadcaster + ws.WebSocketServer
 * to the underlying HTTP server.  This approach preserves the existing WS protocol
 * that the web client relies on without requiring @nestjs/websockets.
 */
export const WS_GATEWAY_PLACEHOLDER = "WS_GATEWAY_PLACEHOLDER";
