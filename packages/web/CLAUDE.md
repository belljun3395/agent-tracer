# packages/web

대시보드다. React와 Vite로 만든다.

## 레이어

Feature-Sliced Design 여섯 레이어를 쓴다. 위에서 아래로만 import한다.

- `app/`: 조립, 라우팅, 프로바이더, 전역 스타일.
- `pages/`: 라우트 단위 화면.
- `widgets/`: 독립 UI 블록.
- `features/`: 사용자 행동 단위.
- `entities/`: 도메인 모델과 그 표현.
- `shared/`: UI 킷, 유틸, API 클라이언트, 설정.

## 이 패키지만의 제약

- 규칙은 둘뿐이다. 상위 레이어만 하위 레이어를 import하고, 같은 레이어의 슬라이스끼리는
  직접 import하지 않는다.
- `@monitor/kernel`의 `*.schema.ts`를 값으로 import하지 못한다. 웹 번들이 자립해야 하므로
  타입으로만 쓴다.
- 운영 UI 문자열은 영어로 쓴다. 사용자에게 보이는 한국어 설명 문구는 단일 카탈로그가
  소유하고, 화면은 그 카탈로그의 메시지를 렌더링만 한다. 화면 코드에 한국어 문자열을
  직접 박지 않는다.

## 검증

```bash
npx vitest run packages/web && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
