# Backend Server

`packages/server`는 Agent Tracer의 저장과 조회를 책임지는 중심 패키지다.

## 구조

```text
bootstrap/
  create-monitor-runtime.ts   # 전체 조합 루트
application/
  monitor-service.ts          # 핵심 유스케이스 진입점
  services/                   # 보조 정책/메타데이터 처리
  ports/                      # 저장소/알림 인터페이스
presentation/
  http/routes/                # Express route modules
  ws/                         # WebSocket broadcaster
infrastructure/sqlite/
  *.repository.ts             # SQLite 구현체
```

## 주요 흐름

### 1. 조합

- `bootstrap/create-monitor-runtime.ts`에서 SQLite ports, `MonitorService`, Express 앱, WebSocket 서버를 한 번에 조합한다.
- 구조를 따라가기 쉬운 "composition root"가 존재한다는 점은 장점이다.

### 2. HTTP

- `presentation/http/routes`는 비교적 얇다.
- `presentation/schemas.ts`의 Zod 스키마로 입력 검증을 먼저 하고 `MonitorService`로 위임한다.

### 3. 애플리케이션 서비스

- `MonitorService`가 태스크 시작/종료, 런타임 세션, 이벤트 기록, 검색, 북마크, 평가까지 처리한다.
- 기능은 모두 한 곳에 모여 있어 진입은 쉽지만, 응집도보다 편의성이 우선된 형태다.

### 4. 영속성

- 실제 사용 경로는 `infrastructure/sqlite/*.repository.ts` + `infrastructure/sqlite/index.ts`다.
- 저장소 인터페이스가 있어 테스트하기 좋은 편이다.

## 좋은 점

- 레이어 경계가 이름만 있는 것이 아니라 실제 파일 구조로 반영되어 있다.
- ports 기반 설계 덕분에 테스트 작성성이 좋다.
- `SessionLifecyclePolicy`, `TraceMetadataFactory`, `EventRecorder`처럼 일부 보조 책임은 이미 분리돼 있다.
- WebSocket broadcaster가 별도 클래스로 떨어져 있어 presentation concern이 드러난다.

## 유지보수 리스크

### `MonitorService`가 너무 많은 유스케이스를 들고 있다

- lifecycle
- runtime-session binding
- generic event logging
- bookmark CRUD
- search
- evaluation / workflow library

이 조합은 초기 개발 속도에는 유리하지만, 장기적으로는 변경 영향 범위를 넓힌다.

권장 분리:

- `TaskLifecycleService`
- `RuntimeSessionService`
- `EventLoggingService`
- `BookmarkService`
- `WorkflowEvaluationService`

### 스키마와 DTO가 병렬로 진화하고 있다

- `presentation/schemas.ts`
- `application/types.ts`

필드가 많아질수록 Zod schema와 TS interface가 같이 수정돼야 한다.
지금은 규칙이 명확해 관리 가능하지만, 변경량이 늘면 drift가 생기기 쉽다.

권장 방향:

- Zod schema에서 DTO 타입을 추론하거나
- 공통 입력 shape를 더 작게 쪼개 재사용률을 높인다.

현재 상태(리팩터링 반영 중):

- `presentation/schemas.ts`가 `schemas.constants.ts`로 상태/열거형 집합을 분리해 사용하고 있어,
  같은 값 목록의 중복 정의가 줄어들었다.
- 향후 `TASK_KIND`, `TASK_STATUS`, `RELATION_TYPE` 계열 값이 변경될 때
  공통 상수 계열에서 한 곳만 수정해 일관성 유지가 쉬워졌다.

### 사용되지 않는 레거시 인프라가 남아 있다

- `infrastructure/monitor-database.ts`는 대형 SQLite 구현이지만 현재 조합 경로에서 사용되지 않는다.
- 실제 경로는 `infrastructure/sqlite/*`다.

이 파일은 신규 기여자에게 "어느 구현이 진짜인가?"라는 혼란을 준다.
문서화만으로 덮기보다 정리 대상이다.

### 프로세스 수명 동안 계속 쌓이는 in-memory dedupe 상태

- `MonitorService`의 `seenAsyncEvents`

중복 방지 자체는 합리적이지만, 장시간 실행 서버에서 정리 정책이 없으면 메모리 누적 포인트가 된다.
task completion/session end 시점 정리나 bounded cache 전략을 검토하는 편이 좋다.

### 읽기 경로가 생각보다 비싸다

- task list 조회 시 `displayTitle`을 만들기 위해 이벤트 이력을 다시 읽는 경로가 있다.
- 이 비용은 descendant traversal 같은 상위 로직에도 번질 수 있다.

현재 규모에서는 괜찮아 보여도, 태스크 수와 이벤트 수가 늘면 read-model 계산 비용이 먼저 커질 가능성이 높다.

권장 방향:

- `displayTitle`을 write 시점에 materialize
- 혹은 별도 read-model/cached projection으로 분리

### 에러 처리가 너무 뭉뚱그려져 있다

- 글로벌 에러 핸들러는 대부분의 예외를 HTTP 400으로 돌려준다.
- 검증 실패, not found, 충돌, 내부 오류가 presentation 계층에서 충분히 구분되지 않는다.

이 구조는 클라이언트와 운영 로그 모두에서 실패 원인 파악을 어렵게 만든다.

권장 방향:

- typed application error
- centralized HTTP error mapping
- 400 / 404 / 409 / 500 분리

### 워크플로우 검색이 persistence-heavy 하다

- workflow search는 결과마다 이벤트를 다시 읽고 context markdown을 만든다.
- 기능적으로는 맞지만, 라이브러리 데이터가 커질수록 조회 시간이 빠르게 커질 수 있다.

중기 개선:

- 검색용 요약 read model
- workflow context precompute 또는 lazy expansion
- 전체 이벤트 로드 대신 필요한 단면만 조회

## API 설계 관점

장점:

- 엔드포인트 역할이 비교적 선명하다.
- 런타임별 차이를 API map 문서와 연결해 이해하기 쉽다.

주의점:

- event logging endpoint가 많아질수록 route/schema/service 동시 수정량이 커진다.
- 이벤트별 거의 동일한 코드가 route, schema, mcp 등록부에서 반복된다.
- 일부 schema/service surface는 현재 HTTP 경로에 완전히 연결되지 않은 흔적이 있다.

중기 개선:

- endpoint descriptor 기반 선언형 등록
- 공통 event route factory
- 공통 trace metadata schema 조립

## 성능 관점

- SQLite + better-sqlite3 조합은 로컬 도구로는 잘 맞는다.
- 현재 병목은 DB 자체보다 "서비스 단의 책임 집중"과 "UI 측 전체 재조회 패턴"에서 더 빨리 나타날 가능성이 높다.

## 서버 문서를 읽을 때 함께 보면 좋은 파일

- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`
- `packages/server/src/presentation/http/routes/`
- `packages/server/src/infrastructure/sqlite/index.ts`

## 우선 개선 제안

1. `MonitorService`를 유스케이스 단위 서비스로 분리
2. `monitor-database.ts`를 제거하거나 legacy로 명시
3. async dedupe map에 정리 정책 추가
4. schema/DTO 선언 중복 축소
5. endpoint 등록 반복을 선언형 메타데이터로 축소
