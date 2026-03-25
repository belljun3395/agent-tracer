# Maintainability Review - 2026-03-25

이 문서는 2026년 3월 25일 기준 작업 트리를 대상으로 한 개발 관점 리뷰다.
목표는 "지금도 잘 돌아가는가?"보다 "앞으로 계속 바꾸기 쉬운가?"를 평가하는 것이다.

## 총평

이 저장소는 이미 꽤 잘 조직된 모노레포다.

- 패키지 경계가 분명하다.
- 공통 계약을 `@monitor/core`로 모으려는 방향이 좋다.
- 서버는 레이어드 구조를 취하고 있다.
- 테스트도 실제로 존재하고 통과한다.

다만 지금부터는 기능 추가보다 "복잡도 분해"가 더 중요한 단계다.
특히 웹과 서버의 일부 중심 파일은 이제 유지보수 부담이 눈에 띄게 커지고 있다.

## 현재 반영 상태

- `@monitor/server`의 중심 유스케이스 분해 경로에서 `session-lifecycle-policy.ts`는
  클래스로부터 순수 함수들로 정리되었고, workflow context/title 계산 로직은 보조 헬퍼 모듈로 분리됐다.
- `sqlite` JSON 파싱은 `parseJsonField()` 헬퍼로 일원화되어 `sqlite-evaluation-repository.ts`,
  `sqlite-bookmark-repository.ts`, `sqlite-task-repository.ts`, `monitor-database.ts`의 중복 파싱 포인트가 축소된다.

## 가장 중요한 이슈

### 1. 거대 중심 모듈이 너무 많은 책임을 가진다

핫스팟:

- `packages/server/src/application/monitor-service.ts`
- `packages/web/src/App.tsx`
- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/lib/insights.ts`
- `packages/mcp/src/index.ts`

문제:

- 기능 추가는 빠르지만 영향 범위가 넓다.
- 테스트를 고치지 않아도 되는 변경과 꼭 회귀 테스트가 필요한 변경이 같은 파일에서 섞인다.
- 신규 기여자가 "어디를 수정해야 하는지"보다 "어디까지 건드리게 될지"를 예측하기 어렵다.

### 2. 공통 계약이 완전히 단일화되어 있지 않다

관련 파일:

- `packages/core/src/domain.ts`
- `packages/web/src/types.ts`
- `packages/mcp/src/index.ts`

문제:

- 웹이 core의 모델을 상당 부분 재선언한다.
- MCP도 core 계약을 강하게 소비하기보다 수동 등록 파일을 따로 유지한다.
- 서버/API에서 필드가 바뀌면 UI 타입은 조용히 뒤처질 수 있다.

### 3. 레거시 또는 중복 인프라 흔적이 남아 있다

관련 파일:

- `packages/server/src/infrastructure/monitor-database.ts`
- `packages/server/src/infrastructure/sqlite/index.ts`

문제:

- 실제 경로와 별개로 오래된 구현이 남아 있으면 온보딩 비용이 커진다.
- "삭제하지 못한 코드"는 종종 "누구도 책임지지 않는 코드"가 된다.

### 4. 실시간 UI 갱신 전략이 단순 재조회에 의존한다

관련 파일:

- `packages/web/src/store/useWebSocket.ts`
- `packages/web/src/lib/realtime.ts`
- `packages/server/src/presentation/ws/event-broadcaster.ts`

문제:

- 서버는 payload를 push하지만 웹은 대부분 전체 overview/task detail 재조회로 반응한다.
- 이벤트 수가 증가하면 비용이 선형으로 커진다.

### 5. 선언이 여러 계층에 반복된다

관련 파일:

- `packages/server/src/presentation/schemas.ts`
- `packages/server/src/application/types.ts`
- `packages/mcp/src/index.ts`

문제:

- 새로운 이벤트를 추가할 때 schema, DTO, route, MCP 등록을 모두 따로 수정해야 한다.
- 실수하기 쉬운 구조다.

### 6. 문서와 실제 런타임 동작이 일부 어긋나 있다

관련 파일:

- `docs/guide/claude-setup.md`
- `docs/guide/api-integration-map.md`
- `docs/guide/runtime-capabilities.md`
- `.claude/hooks/stop.ts`
- `.opencode/plugins/monitor.ts`

문제:

- setup/guide 문서 일부가 현재 hook/plugin 동작과 맞지 않는다.
- 설치 문서는 좋은데, 신뢰도가 떨어지면 운영 문서 전체 가치가 같이 깎인다.

### 7. 프런트엔드에 작은 기능 부채가 이미 성능/유지보수 부채로 번지고 있다

관련 파일:

- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/components/TaskEvaluatePanel.tsx`
- `packages/web/src/store/useEvaluation.ts`

문제:

- 평가 데이터가 중복 fetch될 수 있다.
- 빈 task id 호출 가능성도 있어 작은 비효율과 경계 취약점이 존재한다.

### 8. 운영/확장성 측면의 안전장치가 더 필요하다

관련 파일:

- `scripts/setup-external.mjs`
- `.claude/.subagent-registry.json`
- `scripts/start-docker.sh`

문제:

- 외부 설치가 버전 고정 없이 섞일 수 있다.
- 런타임 상태 파일이 추적돼 워크트리를 더럽힐 수 있다.
- 도커 헬퍼 스크립트가 사용자 홈 파일을 조용히 건드린다.

## 축별 평가

### 아키텍처

좋음:

- 모노레포 경계가 명확하다.
- 서버 레이어 구조가 일관된다.

개선 필요:

- 중심 서비스/컴포넌트 분해
- inactive implementation 정리

### OOP / 도메인 모델

좋음:

- core 계약 중심 사고가 분명하다.
- ports 기반 추상화가 있다.

개선 필요:

- use case 단위 객체 분리
- 웹이 core 계약을 복제하는 부분 정리

### 역할 분리

좋음:

- bootstrap, presentation, application, infrastructure라는 큰 축은 맞다.

개선 필요:

- 루트 UI와 대형 유틸 파일이 너무 많은 역할을 겸한다.

### API

좋음:

- 런타임별 API 문서가 비교적 잘 정리돼 있다.

개선 필요:

- endpoint가 늘어날수록 선언 중복이 커진다.
- descriptor 기반 등록으로 바꿀 타이밍이다.

### 성능

좋음:

- 로컬 SQLite 기반 툴이라는 목표에는 잘 맞는다.

개선 필요:

- 실시간 refresh 전략
- 대형 파생 계산의 재사용/분리

### 컨벤션

좋음:

- ESLint + strict TS + 테스트가 있다.

개선 필요:

- 구조 품질에 대한 규칙은 아직 부족하다.
- 문서 업데이트 규칙이 코드 변경 속도를 따라가지 못했다.

### 문서 / 운영

좋음:

- 런타임별 setup guide와 payload spec이 이미 존재한다.

개선 필요:

- lifecycle/source-of-truth 문서를 하나로 정리해야 한다.
- 코드 이해 문서와 운영 문서를 함께 유지하는 루틴이 필요하다.

## 우선순위 로드맵

### Phase 1 - 복잡도 가시화

1. 위키 문서 유지
2. PR 체크리스트 문서화
3. 레거시/미사용 파일 정리 목록 작성
4. lifecycle 문서와 실제 hook/plugin 동작 일치화

### Phase 2 - 구조 분해

1. `MonitorService` 분리
2. `insights.ts` 분리
3. `EventInspector` / `Timeline` 분할
4. shared contract 재수렴
5. evaluation fetch 중복 제거
6. typed event view-model 계층 추가

### Phase 3 - 확장성 강화

1. MCP descriptor 기반 등록
2. notification payload 기반 점진 갱신
3. 구조 린트/의존 규칙 추가
4. 외부 설치 버전 고정
5. cross-platform path / non-ASCII slug 보강

## 결론

이 프로젝트는 "급하게 만든 프로토타입" 단계는 이미 지났다.
지금은 기능을 더 붙이는 것보다, 잘 자란 핵심 모듈을 안전하게 쪼개는 작업이
다음 개발 속도를 결정할 시점이다.

좋은 소식은 기초 체력은 이미 있다는 점이다.
패키지 경계, 테스트, 공통 계약, 런타임 문서라는 기반이 있으므로,
지금 구조 정리를 시작하면 품질을 크게 끌어올릴 수 있다.
