# WebSocket Real-Time Broadcasting

서버는 task/session/event 변경을 WebSocket으로 브로드캐스트한다.

## 핵심 파일

- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/web/src/store/useWebSocket.ts`
- `packages/web/src/lib/realtime.ts`

## 현재 흐름

1. 서버가 notification payload를 보낸다
2. 웹은 message를 받는다
3. 현재는 payload를 직접 머지하기보다 overview/task detail을 다시 조회한다

## 유지보수 메모

- 설계는 단순하고 안전하지만, 이벤트 수가 늘면 비용이 커진다
- 장기적으로는 incremental update 전략이 필요하다
