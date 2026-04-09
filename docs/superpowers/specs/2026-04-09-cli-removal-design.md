# CLI 기능 완전 제거 설계

## 개요

Agent Tracer 프로젝트에서 CLI 채팅 기능 및 관련 인프라를 완전히 제거합니다.

## 삭제 대상

### 1. 서버 - CLI 브릿지 서비스 계층
- `packages/server/src/application/cli-bridge/` 디렉토리 전체
  - `cli-bridge-service.ts` — CLI 브릿지 서비스 인터페이스 및 구현
  - `claude-code-adapter.ts` — Claude Code 어댑터
  - `opencode-adapter.ts` — OpenCode 어댑터
  - `types.ts` — CLI 브릿지 타입 정의

### 2. 서버 - WebSocket 프레젠테이션 계층
- `packages/server/src/presentation/ws/cli-ws-handler.ts` — CLI WebSocket 핸들러
- `packages/server/src/presentation/ws/cli-ws-types.ts` — CLI WebSocket 타입

### 3. 웹 - 채팅 UI
- `packages/web/src/pages/ChatPage.tsx` — 채팅 페이지 전체
- `packages/web/src/components/chat/` 디렉토리 전체
  - 모든 채팅 컴포넌트
- `packages/web/src/hooks/useCliChat.ts` — CLI 채팅 훅
- `packages/web/src/types/chat.ts` — 채팅 타입 정의

### 4. 웹 - 라우팅
- `packages/web/src/App.tsx`에서 ChatPage 라우트 제거

### 5. 테스트
- `packages/server/test/cli-bridge/` 디렉토리 전체
  - `cli-bridge-service.test.ts`
  - `opencode-adapter.test.ts`
  - `claude-code-adapter.test.ts`

### 6. 코어 런타임
- `packages/core/src/runtime-capabilities.defaults.ts`에서 CLI 관련 런타임 기본값 제거

## 의존성 정리

### 삭제할 임포트 추적
- `App.tsx`에서 ChatPage 임포트 제거
- 라우터에서 `/chat` 경로 제거
- bootstrap 또는 DI 설정에서 CLI 브릿지 서비스 등록 제거

### 남겨야 할 부분
- WebSocket 핸들러 레지스트리 자체 (다른 핸들러용)
- `presentation/ws/` 디렉토리 구조

## 구현 순서

1. 서버 테스트 삭제 (`packages/server/test/cli-bridge/`)
2. 서버 비즈니스 로직 삭제 (`packages/server/src/application/cli-bridge/`)
3. 서버 프레젠테이션 계층 정리 (`packages/server/src/presentation/ws/cli-ws-*`)
4. 서버 bootstrap/DI에서 CLI 서비스 등록 제거
5. 웹 컴포넌트 삭제 (`packages/web/src/components/chat/`, `pages/ChatPage.tsx`, `hooks/useCliChat.ts`)
6. 웹 타입 정의 삭제 (`packages/web/src/types/chat.ts`)
7. 웹 라우팅 정리 (`App.tsx`)
8. 코어 런타임 기본값 정리 (`packages/core/src/runtime-capabilities.defaults.ts`)

## 검증

- 빌드 성공 여부 확인 (`npm run build`)
- 테스트 성공 여부 확인 (`npm run test`)
- ESLint 통과 여부 확인 (`npm run lint`)

## 롤백

Git 히스토리에 의존. 원하면 특정 커밋으로 복구 가능.
