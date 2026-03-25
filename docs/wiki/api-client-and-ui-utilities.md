# API Client & UI Utilities

웹의 API 호출과 공용 UI helper는 별도 유틸 레이어로 모여 있다.

## 핵심 파일

- `packages/web/src/api.ts`
- `packages/web/src/lib/realtime.ts`
- `packages/web/src/lib/ui/`
- `packages/web/src/store/useWebSocket.ts`
- `packages/web/src/store/useSearch.ts`

## 역할

- REST 호출 래핑
- WebSocket 연결/재조회
- 공용 class merge, clipboard, lane theme

## 유지보수 메모

- API layer는 단순하지만 캐싱/중복 fetch/에러 처리 전략은 더 정리할 여지가 있다
