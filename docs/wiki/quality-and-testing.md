# Quality And Testing

이 저장소는 "빠르게 성장한 툴" 치고는 테스트가 꽤 잘 갖춰져 있다.
다만 정적 품질 게이트와 구조 문서는 아직 더 정비할 여지가 있다.

## 스크립트

루트 `package.json` 기준:

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run dev`
- `npm run sync:skills`

## 2026-03-25 기준 점검 결과

### 테스트

`npm test` 결과:

- `@monitor/core`: 통과
- `@monitor/mcp`: 통과
- `@monitor/server`: 통과
- `@monitor/web`: 통과

즉, 현재 작업 트리 기준으로 테스트 스위트는 전부 통과했다.

### 빌드

`npm run build` 결과:

- 전체 워크스페이스 빌드 통과
- 웹 프로덕션 번들:
  - JS 약 `393.56 kB`
  - CSS 약 `72.19 kB`

### 린트

`npm run lint` 결과:

- 서버 1건 실패
- 웹 1건 실패

현재 확인된 항목:

1. `packages/server/src/presentation/nestjs/controllers/evaluation.controller.ts`
2. `packages/web/src/components/Timeline.tsx`

중요한 점:

- 이 실패는 2026-03-25 현재 워킹 트리 상태 기준이다.
- 저장소가 이미 변경 중인 상태였으므로, "메인 브랜치가 항상 실패한다"라고 단정하기보다
  "현재 변경 집합은 품질 게이트를 통과하지 못하고 있다"로 보는 편이 정확하다.

## 현재 품질 체계의 장점

- 각 패키지에 test script가 있다.
- `typescript-eslint` type-checked config를 사용한다.
- `no-floating-promises`, `consistent-type-imports` 같은 실전 규칙이 켜져 있다.
- 서버/웹 모두 테스트가 "있는 척"이 아니라 실제 핵심 흐름을 검증한다.

## 보완이 필요한 부분

### 구조 품질에 대한 가드레일은 아직 약하다

현재 린트는 문법/타입 안전 위주다.
아래 같은 구조 규칙은 아직 자동으로 보호되지 않는다.

- 대형 파일 경고
- 순환 의존 금지
- 레이어 침범 금지
- 웹에서 core 계약 복제 금지

### 문서 품질이 코드 품질만큼 자동화되어 있지 않다

- setup guide는 좋지만 코드 이해 문서가 부족했다.
- 새 기능 추가 시 어디 문서를 갱신해야 하는지 체크리스트가 없다.

### CI/PR 기준 문서가 없다

현재 스크립트는 있지만 "PR 전에 무엇을 반드시 통과시켜야 하는가"가 저장소 문서에 분명히 적혀 있지 않다.

## 권장 품질 운영

1. PR 기본 체크를 문서화
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - 관련 guide/wiki 업데이트

2. 구조 경고 룰 추가
   - 대형 파일 상한
   - 레이어 import rule
   - web type duplication 금지 규칙

3. 변경 유형별 체크리스트 추가
   - 새 이벤트 추가
   - 새 런타임 추가
   - 새 UI 패널 추가
   - schema/route/API 변경

4. 리뷰 문서와 위키를 함께 유지
   - 설치 문서와 코드 문서를 분리하되 링크는 촘촘히 건다.
