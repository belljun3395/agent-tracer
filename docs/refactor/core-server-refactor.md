# Core / Server 리팩토링 계획

## 개요

`@monitor/core`와 `@monitor/server` 패키지의 레거시 정리, Ports & Adapters 강화,
Express → NestJS 마이그레이션을 단계적으로 수행한다.

### 현재 상태

| 항목 | 현황 |
|------|------|
| 빌드 | Core: `tsc`, Server: `tsup` (ESM) |
| 웹 프레임워크 | Express 5 (`create-app.ts` → `create-router.ts`) |
| DB | better-sqlite3 동기 API, WAL 모드 |
| DI | 수동 조합 (`bootstrap/create-monitor-runtime.ts`) |
| 아키텍처 | Clean Architecture — `application/ports/` 인터페이스 ← `infrastructure/sqlite/` 구현 |
| 레거시 | `monitor-database.ts` (1,218줄, 미사용) |

---

## Phase 1 — 레거시 정리

> **병렬 실행**: Web Phase 0-2와 병렬 가능

### 1.1 `monitor-database.ts` 삭제

`packages/server/src/infrastructure/monitor-database.ts`는 현재 조합 경로에서 사용되지 않는
레거시 파일이다. `infrastructure/sqlite/` 레포지토리 패턴으로 완전 대체되었으며,
wiki 문서(`sqlite-infrastructure-and-schema.md`, `backend-server.md`, `architecture-and-package-map.md`)에서도
미사용으로 문서화되어 있다.

**삭제 전 런타임 확인 단계:**

```bash
# 1. import 참조 검색 (0건이어야 함)
grep -r "monitor-database" packages/server/src/ --include="*.ts" \
  | grep -v "monitor-database.ts"

# 2. 빌드 확인
npm run build --workspace @monitor/server

# 3. 테스트 확인
npm run test --workspace @monitor/server
```

확인 후 파일 삭제:
```bash
rm packages/server/src/infrastructure/monitor-database.ts
```

### 1.2 Core `index.ts` re-export 정리

`packages/core/src/index.ts`의 현재 12개 re-export를 검토한다.
deprecated로 표시된 re-export는 **Web 리팩토링 완료 전까지** 유지한다.

이유: Web 패키지에서 `@monitor/core`를 import하는 파일이 16개 있으며,
이 경로들이 안정화되기 전에 export를 제거하면 연쇄 빌드 실패가 발생한다.

---

## Phase 2 — Ports & Adapters 강화

> **병렬 실행**: Web Phase 0-2와 병렬 가능

### 2.1 MonitorPorts 인터페이스 유지

현재 `application/ports/index.ts`의 `MonitorPorts` 인터페이스가 잘 설계되어 있다:

```typescript
export interface MonitorPorts {
  readonly tasks: ITaskRepository;
  readonly sessions: ISessionRepository;
  readonly events: IEventRepository;
  readonly runtimeBindings: IRuntimeBindingRepository;
  readonly bookmarks: IBookmarkRepository;
  readonly evaluations: IEvaluationRepository;
  readonly notifier: INotificationPublisher;
}
```

이 구조를 유지하면서 각 포트의 계약(인터페이스)을 강화한다.

### 2.2 better-sqlite3 동기 API 래핑 전략

현재 `SqliteXxxRepository` 클래스들은 better-sqlite3의 동기 API를 직접 사용한다.
NestJS 전환 시 async 파이프라인과의 공존이 필요하다.

**전략: 포트 인터페이스를 async로 변경**

```typescript
// Before (현재 — 동기 반환도 가능한 인터페이스)
findById(id: string): MonitoringTask | undefined;

// After — async 인터페이스로 통일
findById(id: string): Promise<MonitoringTask | undefined>;
```

SQLite 구현체에서는 동기 결과를 `Promise.resolve()`로 감싸지 않고,
async 메서드로 선언하여 엔진이 자동으로 Promise를 생성하게 한다:

```typescript
async findById(id: string): Promise<MonitoringTask | undefined> {
  return this.db.prepare("SELECT ...").get(id); // 동기 호출이지만 async 함수 내부
}
```

이렇게 하면:
- NestJS의 async 파이프라인과 자연스럽게 통합
- 향후 다른 DB 드라이버(async)로 교체 시 인터페이스 변경 불필요
- 기존 동기 성능에 미미한 오버헤드만 추가 (마이크로초 수준)

---

## Phase 3 — NestJS PoC

> **Phase 1-2 완료 후 시작**

### 3.1 호환성 검증 (스캐폴딩 전 필수)

NestJS 도입 전에 아래 호환성을 검증한다:

| 검증 항목 | 위험 요소 | 확인 방법 |
|-----------|-----------|-----------|
| ESM 호환 | NestJS가 CJS 중심 설계 | `"type": "module"` + NestJS 10+ 테스트 |
| 데코레이터 | `experimentalDecorators` vs TC39 | tsconfig 설정 + 런타임 테스트 |
| tsup 번들 | 데코레이터 메타데이터 보존 | `reflect-metadata` + tsup 빌드 확인 |
| better-sqlite3 | Native addon + NestJS lifecycle | Provider로 감싸서 `onModuleDestroy` 테스트 |

**PoC 통과 기준**: `NestFactory.create(AppModule)` → `GET /health` 응답 성공

**PoC 실패 시 대안** (우선순위 순):
1. `@Inject()` 토큰 기반 명시적 DI — 데코레이터 메타데이터 없이 동작
2. 빌드를 `tsup → tsc`로 전환 — 메타데이터 보존 보장
3. `--keepNames` + `esbuild-plugin-reflect-metadata` — tsup 유지하면서 우회

PoC 범위:
```
packages/server/src/nestjs-poc/
  ├── app.module.ts          # 최소 모듈
  ├── health.controller.ts   # GET /health 엔드포인트
  └── database.provider.ts   # better-sqlite3 Provider
```

### 3.2 DI 전환 경로 설계

현재 `create-monitor-runtime.ts`의 수동 DI:

```
createMonitorRuntime()
  → createSqliteMonitorPorts() → 6개 Repository + notifier
  → MonitorService(ports)
  → createApp(service) → Express app
  → http.createServer() + WebSocketServer
```

NestJS Module 전환 시:

```
AppModule
  ├── DatabaseModule      → better-sqlite3 Provider (lifecycle 관리)
  ├── RepositoryModule    → 6개 Repository Provider
  ├── ServiceModule       → MonitorService, 서브서비스들
  ├── WebSocketModule     → EventBroadcaster Gateway
  └── HttpModule          → 라우트별 Controller
```

---

## Phase 4 — Express → NestJS 마이그레이션

### 4.1 API 계약 테스트 게이트

마이그레이션 전에 현재 Express API의 계약 테스트를 작성한다.
`supertest` (이미 devDependencies에 있음)를 사용:

```typescript
// tests/api-contract.test.ts
describe("API Contract", () => {
  it("POST /api/runtime-session-ensure → 200 + { taskId, sessionId }", ...);
  it("POST /api/save-context → 200", ...);
  it("GET /api/tasks → 200 + task[]", ...);
  // ... 모든 라우트
});
```

NestJS 전환 후 동일 테스트가 통과해야 마이그레이션 완료로 간주한다.

**Express/NestJS 듀얼 모드 비교 테스트** (Phase 4 기간 중 사용):
```typescript
// tests/contract-parity.helper.ts
async function assertContractParity(
  expressApp: Express,
  nestApp: INestApplication,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: unknown
) {
  const expressRes = await request(expressApp)[method](path).send(body);
  const nestRes = await request(nestApp.getHttpServer())[method](path).send(body);
  expect(nestRes.status).toBe(expressRes.status);
  expect(nestRes.body).toEqual(expressRes.body);
}
```

**게이트 조건**: 모든 엔드포인트의 계약 테스트 통과 전 Phase 5 진입 불가.

### 4.2 라우트별 컨트롤러 전환

현재 라우트 파일 → NestJS 컨트롤러 매핑:

| Express 라우트 | NestJS 컨트롤러 |
|----------------|-----------------|
| `lifecycle-routes.ts` | `LifecycleController` |
| `event-routes.ts` | `EventController` |
| `bookmark-routes.ts` | `BookmarkController` |
| `evaluation-routes.ts` | `EvaluationController` |
| `search-routes.ts` | `SearchController` |
| `admin-routes.ts` | `AdminController` |

### 4.3 `create-app.ts` → NestJS AppModule 교체

`presentation/create-app.ts` (현재 20줄)를 NestJS `AppModule`로 대체:
- `express.json()` → NestJS 기본 내장
- `createRouter(service)` → Module imports
- `createErrorHandler()` → Exception Filter

---

## Phase 5 — 정리

### 5.1 Express 의존성 제거

```bash
npm uninstall express @types/express --workspace @monitor/server
```

`tsup` 빌드 설정에서 `--external express` 제거.

### 5.2 deprecated re-export 제거

**전제조건**: Web 리팩토링이 완료되어 Core의 deprecated export에 의존하는 코드가 없어야 함.

확인 방법:
```bash
# Web에서 @monitor/core import 확인
grep -r "from \"@monitor/core\"" packages/web/src/ | sort
```

---

## 주요 파일 참조

| 파일 | 역할 | Phase |
|------|------|-------|
| `packages/server/src/infrastructure/monitor-database.ts` | 미사용 레거시 — 삭제 대상 | 1 |
| `packages/core/src/index.ts` | Core re-export 진입점 | 1 |
| `packages/server/src/application/ports/index.ts` | MonitorPorts 인터페이스 | 2 |
| `packages/server/src/infrastructure/sqlite/index.ts` | SQLite 포트 구현 팩토리 | 2 |
| `packages/server/src/bootstrap/create-monitor-runtime.ts` | 현재 DI root | 3 |
| `packages/server/src/presentation/create-app.ts` | Express 앱 팩토리 | 4 |
| `packages/server/src/presentation/http/routes/*.ts` | Express 라우트 (6개) | 4 |
