# Core + Server 개선 및 NestJS 마이그레이션 계획

## Context

`@monitor/core`와 `@monitor/server`의 기술 부채를 해소하고, Express 기반 서버를 NestJS로 전환하며,
프로젝트 전반에 걸쳐 일관된 컨벤션과 클린 아키텍처를 확립한다.

**배경**: 현재 서버는 이미 3계층 클린 아키텍처(bootstrap → presentation → application → infrastructure)를
따르고 있고 포트/어댑터 패턴도 적용되어 있어 NestJS 전환의 기반이 잘 갖춰져 있다.
다만 레거시 파일, 거대 모듈, 분산된 설정값, 로깅 부재 등의 기술 부채가 있다.

## 현재 구조 분석

### Core 패키지 (`packages/core/`, ~2,568줄)

```
src/
├── domain/
│   ├── branded.ts          # 브랜디드 ID 타입 (TaskId, SessionId 등)
│   ├── constants.ts        # 도메인 상수 (메타데이터 키, 계약 버전)
│   ├── types.ts            # 핵심 도메인 타입 (TimelineEvent, MonitoringTask 등)
│   └── utils.ts            # 정규화 및 매핑 유틸리티
├── action-registry.ts      # 액션 분류 로직
├── action-registry.types.ts
├── action-registry.constants.ts
├── classifier.ts           # 이벤트 분류 오케스트레이터
├── classifier.types.ts
├── classifier.helpers.ts   # 레인 분류 헬퍼
├── evidence.ts             # 증거 강도 결정
├── errors.ts               # 에러 계층
├── runtime-capabilities.ts          # 모듈 re-export
├── runtime-capabilities.types.ts    # 어댑터 및 증거 타입
├── runtime-capabilities.constants.ts # 레지스트리/별칭 저장소
├── runtime-capabilities.defaults.ts  # 기본 어댑터 (323줄)
├── runtime-capabilities.helpers.ts   # 어댑터 해석 헬퍼
├── workflow-context.ts     # 워크플로우 마크다운 컨텍스트 빌더
├── workflow-snapshot.ts    # 태스크 스냅샷 추출
├── openinference.ts        # OpenInference 스팬 변환
├── path-utils.ts           # 경로 매칭 유틸리티
└── index.ts                # 퍼블릭 API exports + 사이드이펙트
```

#### Core 강점

- 브랜디드 ID 타입으로 컴파일 타임 안전성 확보 (`TaskId`, `SessionId` 혼용 방지)
- `readonly` 일관 적용으로 불변성 보장
- 에이전트 추상화가 `RuntimeAdapterId` + `RuntimeCapabilities`로 잘 설계됨
- 증거 프로파일(`proven`, `self_reported`, `inferred`, `unavailable`)로 데이터 신뢰도 명시
- 일관된 네이밍 (이벤트 종류: dot notation, 레인: 서술적 단어, 어댑터 ID: kebab-case)

#### Core 발견된 문제

| 심각도 | 문제 | 위치 |
|--------|------|------|
| HIGH | 모듈 import 시 `registerDefaultRuntimeAdapters()` 자동 실행 (사이드이펙트) | `index.ts:15` |
| HIGH | fuzzy 에이전트 매칭 (`.includes("claude")`) — 새 에이전트 이름 충돌 가능 | `runtime-capabilities.helpers.ts:43-48` |
| HIGH | 레인 라우팅 로직이 3곳에 분산 (classifier.helpers, domain/utils, action-registry) | 여러 파일 |
| MEDIUM | 가변 레지스트리 리셋 불가 — 테스트 간 상태 누수 | `runtime-capabilities.constants.ts` |
| MEDIUM | `normalizeRuntimeAdapterId` vs `resolveRuntimeAdapterId` 이름만으로 차이 파악 어려움 | `runtime-capabilities.helpers.ts` |
| MEDIUM | JSDoc 커버리지 ~1.8% — classifier, action-registry 로직 미문서화 | 전반 |
| MEDIUM | 메타데이터 접근 패턴 `typeof value === "string"` ~12회 반복 | evidence.ts, workflow-context.ts |
| LOW | 한영 주석 혼용 | 전반 |
| LOW | `workflow-context.ts` 내 50줄 초과 함수 존재 | workflow-context.ts |

### Server 패키지 (`packages/server/`, Express 기반)

```
src/
├── bootstrap/
│   └── create-monitor-runtime.ts    # 유일한 조합 루트 (DI)
├── application/
│   ├── monitor-service.ts           # 파사드 (559줄, 30+ 퍼블릭 메서드)
│   ├── types.ts                     # 20+ DTO (339줄)
│   ├── observability.ts             # 관측 분석 (1,126줄!)
│   ├── ports/                       # 7개 리포지토리 인터페이스
│   │   ├── task-repository.ts
│   │   ├── event-repository.ts
│   │   ├── session-repository.ts
│   │   ├── runtime-binding-repository.ts
│   │   ├── bookmark-repository.ts
│   │   ├── evaluation-repository.ts
│   │   └── notification-publisher.ts
│   └── services/
│       ├── task-lifecycle-service.ts     (689줄)
│       ├── event-logging-service.ts      (497줄)
│       ├── workflow-evaluation-service.ts
│       ├── event-recorder.ts
│       ├── trace-metadata-factory.ts     (254줄)
│       └── session-lifecycle-policy.ts
├── infrastructure/
│   ├── monitor-database.ts          # 레거시 (1,218줄) — 이미 대체됨
│   ├── sqlite/
│   │   ├── sqlite-schema.ts
│   │   ├── sqlite-task-repository.ts        (289줄)
│   │   ├── sqlite-event-repository.ts       (659줄)
│   │   ├── sqlite-evaluation-repository.ts  (756줄)
│   │   ├── sqlite-session-repository.ts
│   │   ├── sqlite-bookmark-repository.ts
│   │   ├── sqlite-runtime-binding-repository.ts
│   │   ├── sqlite-schema-migrator.ts
│   │   ├── sqlite-search-documents.ts       (231줄)
│   │   └── sqlite-json.ts
│   └── embedding/
│       ├── embedding-service.ts     # HuggingFace 임베딩 (선택적)
│       └── cosine-similarity.ts
├── presentation/
│   ├── create-app.ts                # Express 앱 팩토리
│   ├── create-app.helpers.ts        # 에러 핸들러
│   ├── schemas.ts                   # Zod 스키마 (360줄)
│   ├── http/
│   │   ├── create-router.ts
│   │   ├── validate.ts              # 유효성 검증 미들웨어
│   │   └── routes/                  # 6개 라우트 파일 (436줄)
│   └── ws/
│       └── event-broadcaster.ts     # WebSocket 브로드캐스터
└── index.ts                         # 엔트리포인트 (직접 실행 시 서버 시작)
```

#### Server 강점

- 클린 아키텍처 3계층 분리 잘 되어 있음
- 포트/어댑터 패턴 — 7개 리포지토리 인터페이스와 SQLite 구현 분리
- 수동 DI가 단일 조합 루트(`create-monitor-runtime.ts`)에서 이루어짐
- 비즈니스 로직에 프레임워크 의존성 없음 (NestJS 전환에 유리)
- Zod 기반 유효성 검증 (NestJS 파이프로 재활용 가능)
- 테스트에서 `:memory:` SQLite 사용하는 하니스 패턴

#### Server 발견된 문제

| 심각도 | 문제 | 위치 |
|--------|------|------|
| CRITICAL | 레거시 `monitor-database.ts` (1,218줄) — repository 패턴으로 이미 대체됨 | `infrastructure/monitor-database.ts` |
| HIGH | `observability.ts` 1,126줄 — 분석 로직 모노리스 | `application/observability.ts` |
| HIGH | `sqlite-evaluation-repository.ts` 756줄 — CRUD + 임베딩 + 유사도 + 인덱싱 혼합 | `infrastructure/sqlite/` |
| HIGH | `sqlite-event-repository.ts` 659줄 — CRUD + 검색 + 랭킹 + 임베딩 혼합 | `infrastructure/sqlite/` |
| MEDIUM | 하드코딩된 상수 분산 (`EMBEDDING_DIMS`, `MIN_SEMANTIC_SCORE`, 포트 등) | 여러 파일 |
| MEDIUM | 유효성 검증 패턴 혼용 (`.parse()` vs `.safeParse()`) | `presentation/http/routes/` |
| MEDIUM | 구조적 로깅 없음 (`console.warn`만 사용) | 전반 |
| MEDIUM | 설정 모듈 부재 — 환경변수가 리프 모듈에서 직접 읽힘 | 전반 |
| LOW | DTO 20+개가 단일 파일에 집중 | `application/types.ts` |
| LOW | WebSocket 메시지 형식 미문서화 | `ws/event-broadcaster.ts` |

### 기술 스택

| 계층 | 현재 기술 |
|------|-----------|
| 런타임 | Node.js (ESM) |
| 서버 | Express 5.0.0 |
| WebSocket | ws 8.0.0 |
| 데이터베이스 | better-sqlite3 12.0.0 (동기 API) |
| 유효성 검증 | Zod 3.0.0 |
| AI/ML | @huggingface/transformers 3.8.1 (선택적) |
| 빌드 | tsup (서버), tsc (core) |
| 테스트 | Vitest 3.0.0, Supertest 7.0.0 |

### API 엔드포인트 현황 (27개)

| 카테고리 | 엔드포인트 수 | 설명 |
|----------|---------------|------|
| Admin | 8 | health, overview, tasks 목록/상세, observability, openinference |
| Lifecycle | 10 | task-start/complete/error/link, session-end, runtime-session 등 |
| Events | 16 | tool-used, terminal-command, explore, plan 등 14개 POST + PATCH |
| Bookmarks | 3 | GET/POST/DELETE |
| Evaluation | 5 | task 평가, workflow 검색/조회 |
| Search | 1 | 전문 검색 |
| WebSocket | 1 | `/ws` (upgrade) |

---

## 개선 계획

### Phase 1: Core 패키지 개선

#### 1.1 모듈 import 사이드이펙트 제거 (HIGH)

- **파일**: `packages/core/src/index.ts:15`
- `registerDefaultRuntimeAdapters()` 호출을 barrel export에서 제거
- 명시적 `initializeDefaultAdapters()` 함수를 새로 export
- `resetRuntimeRegistry()` 테스트 유틸리티 추가 (`runtime-capabilities.constants.ts`)
- 서버 부트스트랩(`create-monitor-runtime.ts`)에서 명시적 호출로 변경

**이유**: 사이드이펙트 import는 트리 셰이킹을 방해하고, 테스트 예측성을 떨어뜨리며,
소비자에게 예상치 못한 동작을 유발한다.

#### 1.2 런타임 어댑터 해석 로직 정리

- **파일**: `packages/core/src/runtime-capabilities.helpers.ts:43-48`
- `.includes("claude")` 같은 fuzzy 매칭을 `FUZZY_FALLBACK_PATTERNS` 상수 배열로 전환
- 함수 이름 명확화:
  - `normalizeRuntimeAdapterId` → `resolveAdapterIdByAlias` (엄밀 별칭 매칭만)
  - `resolveRuntimeAdapterId` → `resolveAdapterId` (전체 해석 체인: 정확 → 별칭 → fuzzy)
- 기존 이름은 deprecated re-export로 1 릴리스 유지

**이유**: "CodexAI" 같은 새 에이전트 이름이 기존 fuzzy 매칭과 충돌할 수 있다.
별칭은 명시적으로 등록해야 안전하다.

#### 1.3 레인 라우팅 로직 통합

- `classifier.helpers.ts:getCanonicalLane` (4개 케이스)
- `domain/utils.ts:defaultLaneForEventKind` (17개 케이스)
- `domain/utils.ts:normalizeLane` (별칭 해석)
- 위 3개를 `domain/lanes.ts`로 통합:
  - `resolveCanonicalLane(kind: MonitoringEventKind): TimelineLane` — 이벤트 종류 → 레인
  - `normalizeLaneAlias(raw: string): TimelineLane` — 문자열 별칭 → 레인
- 기존 위치에서 deprecated re-export

**이유**: 레인 라우팅이 3곳에 분산되어 있으면 규칙 변경 시 일관성이 깨지기 쉽다.

#### 1.4 메타데이터 접근 유틸 추출

- `typeof event.metadata["key"] === "string"` 패턴이 ~12회 반복됨
- `domain/utils.ts`에 추가:

```typescript
function getStringMeta(metadata: Record<string, unknown>, key: string): string | undefined;
function getNumberMeta(metadata: Record<string, unknown>, key: string): number | undefined;
```

- `evidence.ts`, `workflow-context.ts` 등 기존 코드 리팩터링

#### 1.5 JSDoc 보강 및 한영 주석 통일

- 대상: `classifier.ts`, `action-registry.ts`, `evidence.ts`, `workflow-context.ts`, `domain/types.ts`
- 모든 exported 함수/인터페이스에 JSDoc 추가 (`@param`, `@returns`, `@throws`)
- 한국어 코드 주석 → 영어로 통일 (CLAUDE.md 등 문서는 한국어 유지)

#### 1.6 workflow-context.ts 긴 함수 분리

- `buildRuleAuditSection` (~70줄) → 통계 누적 루프를 `accumulateRuleStats()` 헬퍼로 추출
- `buildEvidenceSummarySection` → 카운팅 루프를 `countEvidenceLevels()` 헬퍼로 분리

**검증**: `npm run test --workspace @monitor/core` + `npm run test --workspace @monitor/server` 통과

---

### Phase 2: Server 마이그레이션 사전 정리

#### 2.1 레거시 파일 삭제

- **파일**: `packages/server/src/infrastructure/monitor-database.ts` (1,218줄)
- repository 패턴(`sqlite/`)으로 이미 대체됨
- import 참조 확인 (`grep -r "monitor-database"`) 후 삭제

#### 2.2 거대 파일 분리

**observability.ts (1,126줄)**:
- `observability-task-analyzer.ts` — 태스크별 관측 분석
- `observability-overview-analyzer.ts` — 전체 오버뷰 분석
- `observability.types.ts` — 공유 타입/인터페이스
- `observability.ts` — re-export (하위 호환)

**sqlite-evaluation-repository.ts (756줄)**:
- 임베딩 생성 / 유사도 계산 로직을 별도 서비스로 추출 검토
- 순수 CRUD와 검색/랭킹 관심사 분리

#### 2.3 설정 모듈 생성

- **새 파일**: `packages/server/src/config/monitor-config.ts`
- 분산된 상수 통합:

| 상수 | 현재 위치 | 값 |
|------|-----------|-----|
| `EMBEDDING_DIMS` | `embedding/index.ts` | 384 |
| `EMBEDDING_MODEL` | `embedding-service.ts` | `Xenova/all-MiniLM-L6-v2` |
| `MIN_SEMANTIC_SCORE` | `sqlite-event-repository.ts` | 0.22 |
| `SEARCH_EMBEDDING_BACKFILL_THRESHOLD` | `sqlite-event-repository.ts` | 200 |
| 서버 포트 | `index.ts` | 3847 |
| DB 경로 | `index.ts` | `.monitor/monitor.sqlite` |

- 타입 안전한 `MonitorConfig` 인터페이스 정의
- 환경변수에서 읽되 기본값 제공, 부트스트랩에서 주입

#### 2.4 DTO 파일 분리

- `application/types.ts` (339줄, 20+ DTO) →
  - `dtos/task-lifecycle.dto.ts`
  - `dtos/event-logging.dto.ts`
  - `dtos/evaluation.dto.ts`
  - `dtos/runtime-session.dto.ts`
- `types.ts`에서 re-export 유지 (하위 호환)

#### 2.5 유효성 검증 패턴 통일

- 현재: `.parse()` (throw) / `.safeParse()` (result) 혼용
- `validate` 미들웨어(`presentation/http/validate.ts`)를 모든 라우트에 일관 적용
- NestJS 전환 시 `ZodValidationPipe`로 자연스럽게 교체됨

**검증**: 기존 테스트 전부 통과 + `npm run build` 성공

---

### Phase 3: NestJS 스캐폴딩

#### 3.1 의존성 추가

```bash
# 런타임
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/platform-ws @nestjs/websockets --workspace @monitor/server

# 개발
npm install -D @nestjs/testing --workspace @monitor/server
```

- `tsconfig.json`에 `emitDecoratorMetadata: true`, `experimentalDecorators: true` 추가

#### 3.2 NestJS 모듈 구조

| NestJS 모듈 | 현재 매핑 | 역할 |
|---|---|---|
| `AppModule` | `bootstrap/create-monitor-runtime.ts` | 루트 모듈 |
| `ConfigModule` | 새 `config/` | 설정 관리 |
| `SqliteModule` | `infrastructure/sqlite/` | 6개 repository provider |
| `EmbeddingModule` | `infrastructure/embedding/` | 선택적 임베딩 서비스 |
| `TaskModule` | `services/task-lifecycle-service.ts` + admin/lifecycle routes | 태스크 도메인 |
| `EventModule` | `services/event-logging-service.ts` + event routes | 이벤트 도메인 |
| `BookmarkModule` | bookmark routes | 북마크 도메인 |
| `SearchModule` | search routes | 검색 도메인 |
| `EvaluationModule` | `services/workflow-evaluation-service.ts` + evaluation routes | 평가 도메인 |
| `ObservabilityModule` | `observability*.ts` | 관측 분석 |
| `NotificationModule` | `ws/event-broadcaster.ts` → `MonitorGateway` | WebSocket |

#### 3.3 공통 인프라 생성

- `shared/pipes/zod-validation.pipe.ts` — 기존 Zod 스키마(`schemas.ts`)를 NestJS 파이프로 래핑
- `shared/filters/http-exception.filter.ts` — `AppError`/`ZodError` → HTTP 상태코드 매핑
- `shared/tokens.ts` — DI 주입 토큰 (`DATABASE`, `EMBEDDING_SERVICE`, 각 리포지토리 인터페이스)

#### 3.4 AppModule 생성

- **새 파일**: `packages/server/src/app.module.ts`
- 모든 피처 모듈 import
- `better-sqlite3` DB 인스턴스를 `useFactory` 커스텀 프로바이더로 등록
- `SqliteModule`이 DB 인스턴스를 받아 모든 리포지토리를 생성/제공

**검증**: `npm run build --workspace @monitor/server` 컴파일 성공 (런타임 변경 없음)

---

### Phase 4: NestJS 컨트롤러 및 프로바이더 구현

#### 4.1 컨트롤러 구현 순서

의존성이 적은 것부터:

1. `HealthController` → `GET /health`
2. `TaskController` → 태스크 CRUD, 라이프사이클, 관리 조회 (admin + lifecycle routes 통합)
3. `EventController` → 13개 이벤트 로깅 POST + PATCH
4. `BookmarkController` → 북마크 CRUD
5. `SearchController` → 검색
6. `EvaluationController` → 평가 CRUD + 워크플로우 검색
7. `ObservabilityController` → 관측 가능성

각 컨트롤러:
- `@nestjs/common` 데코레이터 사용 (`@Controller`, `@Get`, `@Post`, `@Body`, `@Param` 등)
- 생성자 주입으로 서비스 의존
- `ZodValidationPipe`로 기존 Zod 스키마 재활용

#### 4.2 WebSocket 게이트웨이

- **새 파일**: `shared/gateways/monitor.gateway.ts`
- `@WebSocketGateway` 데코레이터, 경로 `/ws`
- 연결 시 스냅샷 전송 (현재 `wss.on("connection")` 로직 이관)
- `INotificationPublisher` 인터페이스 구현

#### 4.3 서비스 프로바이더 등록

- 기존 서비스 클래스는 생성자 시그니처 유지 (수정 최소화)
- NestJS `useFactory`로 `MonitorPorts` 조합 후 `MonitorService`에 주입
- 각 하위 서비스도 `TaskModule`, `EventModule` 등에서 개별 프로바이더로 등록

#### 4.4 듀얼 모드 부트스트랩

- `main.ts` — NestJS `NestFactory.create(AppModule)`
- `index.ts` — 기존 Express 모드 유지 (전환 완료 전까지)
- 병렬 구동으로 응답 비교 테스트 가능

**검증**: 각 컨트롤러별 NestJS 테스트 모듈 작성, Express 응답과 계약 비교

---

### Phase 5: NestJS 전환 완료

#### 5.1 엔트리포인트 교체

- `index.ts`에서 `NestFactory.create(AppModule)` 사용
- `createMonitorRuntime`은 `@deprecated` 표시 후 export 유지 (MCP 등 소비자 전환 시간)

#### 5.2 빌드 설정 업데이트

- tsup external에 `@nestjs/*` 추가
- 데코레이터 메타데이터 보존 확인 (esbuild + `emitDecoratorMetadata`)
- 문제 발생 시 서버 빌드를 tsup → tsc로 전환 검토

#### 5.3 테스트 하니스 마이그레이션

- `createNestTestApp()` 헬퍼 추가 (기존 `createRuntimeHarness()` 병행)
- supertest 테스트를 `@nestjs/testing` `Test.createTestingModule` 기반으로 전환
- 기존 헬퍼는 전체 전환 완료 전까지 유지

**검증**: 전체 테스트 통과 + 수동 스모크 테스트 (웹 프론트엔드 연결, WebSocket 이벤트 확인)

---

### Phase 6: 정리

#### 6.1 Express 전용 파일 삭제

- `presentation/create-app.ts`, `create-app.helpers.ts`
- `presentation/http/create-router.ts`, `validate.ts`
- `presentation/http/routes/*.ts` (NestJS 컨트롤러로 대체됨)
- `presentation/schemas.ts`는 유지 (Zod 스키마를 NestJS 파이프에서 재활용)

#### 6.2 최종 디렉터리 구조

```
packages/server/src/
├── main.ts                              # NestJS 부트스트랩
├── app.module.ts                        # 루트 모듈
├── config/
│   ├── config.module.ts
│   └── monitor-config.ts
├── modules/
│   ├── task/
│   │   ├── task.module.ts
│   │   ├── task.controller.ts
│   │   ├── task-lifecycle.service.ts
│   │   └── dtos/
│   ├── event/
│   │   ├── event.module.ts
│   │   ├── event.controller.ts
│   │   ├── event-logging.service.ts
│   │   └── dtos/
│   ├── bookmark/
│   │   ├── bookmark.module.ts
│   │   └── bookmark.controller.ts
│   ├── search/
│   │   ├── search.module.ts
│   │   └── search.controller.ts
│   ├── evaluation/
│   │   ├── evaluation.module.ts
│   │   ├── evaluation.controller.ts
│   │   └── workflow-evaluation.service.ts
│   └── observability/
│       ├── observability.module.ts
│       ├── observability.controller.ts
│       ├── observability-task-analyzer.ts
│       └── observability-overview-analyzer.ts
├── infrastructure/
│   ├── sqlite/
│   │   ├── sqlite.module.ts
│   │   ├── sqlite-task-repository.ts
│   │   ├── sqlite-event-repository.ts
│   │   ├── sqlite-evaluation-repository.ts
│   │   ├── sqlite-session-repository.ts
│   │   ├── sqlite-bookmark-repository.ts
│   │   ├── sqlite-runtime-binding-repository.ts
│   │   ├── sqlite-schema.ts
│   │   ├── sqlite-schema-migrator.ts
│   │   └── sqlite-json.ts
│   └── embedding/
│       ├── embedding.module.ts
│       ├── embedding-service.ts
│       └── cosine-similarity.ts
└── shared/
    ├── pipes/zod-validation.pipe.ts
    ├── filters/http-exception.filter.ts
    ├── gateways/monitor.gateway.ts
    ├── schemas.ts                       # 기존 Zod 스키마 (이동)
    └── tokens.ts                        # DI 주입 토큰
```

---

## 컨벤션 정리

### 파일 및 네이밍

| 항목 | 규칙 | 예시 |
|---|---|---|
| 파일명 | kebab-case | `task-lifecycle.service.ts` |
| 클래스 = 파일 | 1 클래스 = 1 파일 | `TaskLifecycleService` → `task-lifecycle.service.ts` |
| NestJS 모듈 | `{Domain}Module` | `TaskModule` |
| NestJS 컨트롤러 | `{Domain}Controller` | `TaskController` |
| NestJS 서비스 | `{Domain}Service` | `TaskLifecycleService` |
| DTO | `{Action}{Entity}Dto` | `CreateTaskDto`, `LogToolUsedDto` |
| 포트 인터페이스 | `I{Entity}Repository` | `ITaskRepository` (기존 유지) |
| 상수 파일 | `{module}.constants.ts` | `event-recorder.constants.ts` |
| 타입 파일 | `{module}.types.ts` | `observability.types.ts` |
| 헬퍼 파일 | `{module}.helpers.ts` | `classifier.helpers.ts` |

### 코드 품질

| 항목 | 기준 |
|---|---|
| 파일 크기 | 400줄 가이드라인, 800줄 절대 최대 |
| 함수 크기 | 50줄 이하 |
| JSDoc | 모든 exported 함수/인터페이스 필수 |
| 주석 언어 | 영어 (코드 주석), 한국어 (문서/CLAUDE.md) |
| 유효성 검증 | Zod 스키마 + `ZodValidationPipe` |
| 로깅 | NestJS 내장 `Logger` 사용 (`console.log` 금지) |
| 에러 처리 | `AppError` 계층 사용, `HttpExceptionFilter`에서 매핑 |
| 불변성 | `readonly` 일관 적용, 객체 변경 대신 새 객체 생성 |

### 테스트

| 항목 | 기준 |
|---|---|
| 커버리지 | 80% 이상 |
| 단위 테스트 | 서비스 로직, 유틸리티, 분류기 |
| 통합 테스트 | HTTP 엔드포인트 (supertest 또는 @nestjs/testing) |
| DB 테스트 | `:memory:` SQLite 사용 |
| 패턴 | AAA (Arrange-Act-Assert) |

---

## 리스크 및 대응

| 리스크 | 영향도 | 대응 |
|--------|--------|------|
| NestJS 데코레이터 + ESM 호환성 | HIGH | Phase 3에서 빌드 테스트 선행. 실패 시 명시적 `@Inject()` 토큰 사용 |
| better-sqlite3 동기 API vs NestJS 비동기 | MEDIUM | 기존 패턴 유지 (async 메서드 내 동기 호출). `onModuleInit`에서 스키마 초기화 |
| WebSocket 마이그레이션 단절 | MEDIUM | `@nestjs/platform-ws` 사용, 전환 중 양쪽 모두 구동하여 비교 |
| MCP/Web 하위 호환성 | HIGH | HTTP 엔드포인트 경로와 요청/응답 형태 변경 없음. 계약 테스트로 검증 |
| tsup + NestJS 번들링 문제 | MEDIUM | tsup → tsc 전환 또는 `--keepNames` 옵션으로 메타데이터 보존 확인 |
| 마이그레이션 중 기능 회귀 | HIGH | Phase별 게이트: 기존 테스트가 항상 통과해야 다음 단계 진행 |

---

## 검증 전략

| Phase | 검증 방법 |
|---|---|
| Phase 1 | `npm run test --workspace @monitor/core` + `--workspace @monitor/server` 통과 |
| Phase 2 | server 테스트 통과 + `npm run build` + 수동 스모크 테스트 |
| Phase 3 | 빌드 성공 (런타임 변경 없음) |
| Phase 4 | 컨트롤러별 NestJS 테스트 + Express 응답과 계약 비교 |
| Phase 5 | 전체 테스트 + 웹 프론트엔드 연결 + WebSocket 확인 |
| Phase 6 | 전체 테스트 + Express import 잔존 여부 확인 |

**연속 검증**: 모든 서브스텝은 별도 커밋. 매 커밋 시 `npm run build && npm run test && npm run lint` 통과 필수.

---

## 주요 수정 대상 파일

### Core

| 파일 | 작업 |
|------|------|
| `packages/core/src/index.ts` | 사이드이펙트 제거, `initializeDefaultAdapters()` export |
| `packages/core/src/runtime-capabilities.helpers.ts` | 어댑터 해석 정리, 네이밍 개선 |
| `packages/core/src/runtime-capabilities.constants.ts` | `resetRuntimeRegistry()` 추가 |
| `packages/core/src/classifier.helpers.ts` | 레인 로직 → `domain/lanes.ts`로 이관 |
| `packages/core/src/domain/utils.ts` | 메타데이터 유틸 추가, 레인 로직 이관 |
| `packages/core/src/workflow-context.ts` | 긴 함수 분리 |
| `packages/core/src/classifier.ts` | JSDoc 추가 |
| `packages/core/src/action-registry.ts` | JSDoc 추가 |

### Server

| 파일 | 작업 |
|------|------|
| `packages/server/src/infrastructure/monitor-database.ts` | 삭제 |
| `packages/server/src/application/observability.ts` | 3개 파일로 분리 |
| `packages/server/src/application/types.ts` | DTO 파일 분리 |
| `packages/server/src/bootstrap/create-monitor-runtime.ts` | NestJS AppModule로 전환 |
| `packages/server/src/index.ts` | NestJS main.ts로 전환 |
| `packages/server/package.json` | NestJS 의존성 추가 |
| `packages/server/tsconfig.json` | 데코레이터 메타데이터 설정 |
| `packages/server/src/config/monitor-config.ts` | 새 파일 (설정 모듈) |
| `packages/server/src/app.module.ts` | 새 파일 (루트 모듈) |
| `packages/server/src/main.ts` | 새 파일 (NestJS 부트스트랩) |
