# Testing & Development

이 문서는 Agent Tracer를 수정할 때 가장 자주 쓰는 명령과,
어떤 종류의 테스트가 어디에 있는지 정리한 개발용 시작점이다.

## 루트 명령

```bash
npm run build
npm run lint
npm test
npm run dev
```

## 패키지별 명령

- `@monitor/core`: `npm run test --workspace @monitor/core`
- `@monitor/server`: `npm run test --workspace @monitor/server`
- `@monitor/mcp`: `npm run test --workspace @monitor/mcp`
- `@monitor/web`: `npm run test --workspace @monitor/web`

## 자주 쓰는 개발 루프

### 로컬 앱 개발

```bash
npm run dev
```

### 서버만 보기

```bash
npm run dev:server
```

### 특정 패키지 빌드 확인

```bash
npm run build --workspace @monitor/server
npm run build --workspace @monitor/web
```

## 코드 수정 시 체크포인트

- core contract를 바꿨으면 web/types import와 server schema를 같이 확인
- runtime adapter를 바꿨으면 guide 문서와 capability registry를 같이 갱신
- workflow library를 바꿨으면 evaluation route, repository, web panel을 같이 확인

## 관련 문서

- [Server-Side Tests](./server-side-tests.md)
- [Web & Core Tests](./web-and-core-tests.md)
- [Quality And Testing](./quality-and-testing.md)
