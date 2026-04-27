# Feature Module Architecture

> Server-side feature module 구조와 의존성 규칙. 신규/마이그레이션 모듈은 모두 이 패턴을 따른다.

## 현재 적용 모듈

| 모듈 | 위치 | 영속화 | 비고 |
|---|---|---|---|
| **session** | `~session/` | TypeORM | SessionEntity, RuntimeBindingEntity, EventLogEntity |
| **task** | `~task/` | TypeORM | TaskEntity, TaskRelationEntity (+ TaskEventLogEntity for subscriber) |
| **event** | `~event/` | TypeORM | TimelineEventEntity + 6 derived entities; FTS/event-sourcing은 outbound port로 분리 |
| **rule** | `~rule/` | TypeORM | RuleEntity (soft-delete via `deleted_at`) |
| **verification** | `~verification/` | TypeORM | TurnEntity, TurnEventEntity, VerdictEntity, RuleEnforcementEntity |

5개 모듈 모두 동일한 vertical slice 패턴 — 신규 모듈은 이 패턴을 그대로 복제.

## 핵심 원칙

1. **모듈 = 기능 단위 (vertical slice)**. 각 모듈은 자기 도메인을 완결적으로 소유한다.
2. **의존 방향은 한 방향**. controller → usecase → service → repository → domain. 역방향 금지.
3. **모듈 간 통신은 contract를 통해서만**. 다른 모듈 internal에 직접 접근 금지.
4. **Self-contained ports**. cross-module contract는 외부 타입을 import하지 않고 자체 정의한다 (adapter만 외부 타입 인지).
5. **Microservice 분리 가능성을 전제로 설계**. public/ 은 곧 endpoint, outbound adapter는 곧 transport client.
6. **Module은 `global: true`**. 5개 모듈 간에 cross-module token 의존이 양방향이라 (session ↔ task, task ↔ event, rule ↔ verification 등) explicit `imports`는 cyclic 충돌을 일으킨다. global 등록으로 token resolution을 app-wide로 두고, 격리는 `dep-cruiser` 룰에서 enforced.

---

## 표준 폴더 구조

```text
packages/server/src/<module>/
├── common/                              # 모듈 내부에서 재사용되는 상수/에러/슬러그
│   ├── *.errors.ts                      # 도메인 에러 (NotFoundError 등)
│   ├── *.const.ts                       # 도메인 상수 (TERMINAL_STATUSES 등)
│   └── *.ts                             # slug/display-title 등 pure helper
├── domain/                              # 엔티티, 도메인 모델, 도메인 규칙
│   ├── *.entity.ts                      # TypeORM @Entity (DB-mapped, 영속화 대상)
│   ├── *.model.ts                       # 도메인 모델 클래스 (in-memory, 데이터 + 행위)
│   └── *.ts                             # 그 외 value object / 순수 helper
├── repository/                          # TypeORM Entity 영속화 (thin — 비즈니스 로직 금지)
├── service/                             # 도메인 조합, 공통 정책 (내부 + 공개 iservice 구현)
├── application/
│   ├── outbound/                        # 외부 의존 contract (consumer-defined)
│   │   ├── *.port.ts                    # interface (self-contained, no external imports)
│   │   └── tokens.ts
│   ├── dto/                             # usecase 입출력 DTO
│   └── *.usecase.ts                     # API 1:1 대응 (UseCase#execute)
├── adapter/                             # outbound port 구현 (외부 모듈 wrap)
│   └── *.adapter.ts
├── public/                              # 외부에 제공하는 contract
│   ├── iservice/                        # interface (IXxx)
│   │   └── *.iservice.ts
│   ├── dto/                             # wire-format DTO (primitive-typed)
│   │   └── *.dto.ts
│   └── tokens.ts                        # DI 토큰
├── api/                                 # HTTP / ingest controllers
│   ├── *.controller.ts
│   └── *.schema.ts                      # zod validation schemas
├── subscriber/                          # TypeORM EventSubscriber 등 lifecycle hooks
└── <module>.module.ts                   # NestJS Dynamic Module
```

> **`common/` vs `domain/`**: domain은 entity/model/value object/사건 표현. common은 그 외 전부 — 에러 타입, status 상수 enum, slug 생성 같은 pure helper. domain layer를 "비즈니스 의미"로 좁게 두기 위함.

> **Repository thin 원칙**: repository에는 SELECT/INSERT/UPDATE 만. "어떤 status가 finished인가" 같은 도메인 결정은 domain model이 소유하고, repository는 결정의 결과를 받는 generic query만 노출 (`listIdsByStatuses(statuses)` ✓ vs `listFinishedIds()` ✗). 참고: `task/repository/task.repository.ts`, `task/domain/task.relations.model.ts`.

---

## Layer 책임

| Layer | 책임 | 의존 가능 | 의존 금지 |
|---|---|---|---|
| **domain** | 엔티티(`*.entity.ts`), 도메인 모델(`*.model.ts`), 규칙, value object | 공유 도메인 (`~domain/`) | 같은 모듈의 다른 layer 전부 |
| **repository** | `@Entity` 영속화. TypeORM 호출 | domain | service / application / api / adapter / subscriber |
| **service** | 도메인 조합, 공통 정책. usecase가 호출 | domain, repository, public/dto, application/outbound | application/dto/usecase, api / adapter / subscriber |
| **application/usecase** | API endpoint 1:1 대응. 사이드이펙트 오케스트레이션 | service, domain, application/outbound | repository (직접), api / adapter / subscriber |
| **application/outbound** | 외부 모듈 의존 contract (interface만) | — (self-contained) | 모든 외부 import |
| **adapter** | outbound port 구현. 외부 모듈 wrap | application/outbound, ~application/, ~adapters/ 등 외부 | application internals (usecase, dto), api, subscriber |
| **public/iservice** | 외부 모듈에 제공할 interface | public/dto | 같은 모듈의 다른 layer |
| **public/dto** | wire-format DTO | — | — |
| **api** | HTTP transport. 입력 검증 + usecase 호출 | application | service / repository / domain / adapter / subscriber |
| **subscriber** | TypeORM 등 lifecycle 훅 | domain, repository | usecase, controller |

---

## 두 종류의 contract

### 1. Public — 모듈이 외부에 **제공**하는 것

다른 모듈이 사용할 수 있는 contract. 향후 microservice 전환 시 endpoint로 노출되는 surface.

**어휘:** `iservice` (interface) + `service` (implementation)

```ts
// public/iservice/<aggregate>.<concern>.iservice.ts
export interface IXxxLifecycle {
    create(input: XxxCreateInput): Promise<XxxSnapshot>;
    findById(id: string): Promise<XxxSnapshot | null>;
}
```

```ts
// public/dto/<aggregate>.snapshot.dto.ts
export interface XxxSnapshot {
    readonly id: string;
    readonly status: "running" | "completed" | "errored";
    // primitive 타입만 — JSON 직렬화 가능해야 함
}
```

```ts
// public/tokens.ts
export const XXX_LIFECYCLE = "XXX_LIFECYCLE";
```

**구현은 service가 담당:**
```ts
// service/<aggregate>.<concern>.service.ts
@Injectable()
export class XxxLifecycleService /* implements IXxxLifecycle (구조적으로) */ {
    // service의 표면이 iservice의 superset이어도 됨 — 외부는 iservice로 좁게 봄
}
```

**Module 등록:**
```ts
{ provide: XXX_LIFECYCLE, useExisting: XxxLifecycleService }
```

> **언제 별도 public adapter 클래스가 필요한가?**
> service 표면 = iservice 표면 → 불필요 (`useExisting: service` 직결)
> service 표면 ≠ iservice (인증/필터링/타입 변환 필요) → adapter 클래스 둠

### 2. Outbound — 모듈이 외부에서 **소비**하는 것

이 모듈의 usecase가 다른 모듈/외부 시스템에서 받아야 하는 것. consumer가 자기 needs를 자기 언어로 정의 (anti-corruption layer).

**어휘:** `port` (interface) + `adapter` (implementation)

```ts
// application/outbound/<concern>.port.ts
// 자기 완결적 — 외부 import 0개. adapter만 외부를 알게.

export type AlienStatus = "active" | "inactive";

export interface AlienRecord {
    readonly id: string;
    readonly status: AlienStatus;
}

export interface IAlienAccess {
    findById(id: string): Promise<AlienRecord | null>;
}
```

```ts
// application/outbound/tokens.ts
export const ALIEN_ACCESS_PORT = "<MODULE>_ALIEN_ACCESS_PORT";
```

**구현은 adapter — 외부 모듈을 wrap (외부 import 허용되는 유일한 곳):**
```ts
// adapter/<concern>.adapter.ts
@Injectable()
export class AlienAccessAdapter implements IAlienAccess {
    constructor(
        @Inject(ALIEN_REPO_TOKEN) private readonly inner: IAlienRepository,  // ← 외부 모듈 import
    ) {}

    async findById(id: string): Promise<AlienRecord | null> {
        return this.inner.findById(id);    // 또는 외부 타입 → 로컬 타입 매핑
    }
}
```

**Module 등록:**
```ts
{ provide: ALIEN_ACCESS_PORT, useExisting: AlienAccessAdapter }
```

> **왜 이렇게?** outbound port 파일이 외부 타입을 import하면, 그 외부 모듈 변경이 port 파일까지 전파됨. self-contained로 두면 외부 변경은 adapter 한 곳에서만 흡수됨. 또한 microservice 전환 시 in-process adapter를 HTTP/gRPC adapter로 교체하기만 하면 됨.

---

## 어휘 사용 규약

| Direction | Interface | Implementation | 위치 |
|---|---|---|---|
| 외부에 **제공** | `iservice` | `service` | `public/iservice/`, `service/` |
| 외부에서 **소비** | `port` | `adapter` | `application/outbound/`, `adapter/` |

> "service에 가까운 것 = 내가 노출 / port에 가까운 것 = 내가 의존"

---

## 파일 명명 규약

`<aggregate>.<concern>.<layer>.ts` — 점(`.`)으로 계층 표현. 하이픈(`-`) 사용 금지.

| 예시 | 의미 |
|---|---|
| `session.entity.ts` | session 엔티티 (TypeORM 매핑) |
| `runtime.session.end.model.ts` | runtime session end 시점의 도메인 모델 (data + behavior) |
| `session.lifecycle.service.ts` | session의 lifecycle 책임 service |
| `ensure.runtime.session.usecase.ts` | session 모듈의 usecase |
| `task.access.port.ts` | task에 대한 outbound port |
| `task.access.adapter.ts` | task.access.port의 adapter 구현 |
| `session.lifecycle.iservice.ts` | session lifecycle의 public interface |
| `session.snapshot.dto.ts` | session snapshot 포맷의 DTO |
| `session.event.subscriber.ts` | session entity 변경 hook |

클래스 / interface 명:
- 클래스: PascalCase, 파일명과 매칭 (`SessionLifecycleService`)
- interface: `I` prefix (`ISessionLifecycle`, `ITaskAccess`)
- 토큰: UPPER_SNAKE_CASE, 의미 위주 (`SESSION_LIFECYCLE`, `TASK_ACCESS_PORT`)
- usecase 클래스: `XxxUseCase` (`EnsureRuntimeSessionUseCase`)
- usecase 메서드: 항상 `execute(input)` 단일 진입점

---

## 모듈 간 의존성 규칙

### 외부 → 이 모듈
다른 모듈은 **오직 `~<module>/public/`** 만 import 가능. internal (`domain`, `service`, `repository`, `application`, `api`, `subscriber`, `adapter`)은 접근 불가.

```ts
// 다른 모듈 ✅
import type { IXxxLifecycle } from "~xxx/public/iservice/xxx.lifecycle.iservice.js";
import { XXX_LIFECYCLE } from "~xxx/public/tokens.js";

// 다른 모듈 ❌
import { XxxLifecycleService } from "~xxx/service/xxx.lifecycle.service.js";   // internal 노출
```

### 이 모듈 → 다른 모듈
**오직 `adapter/` 폴더 내 파일만** 외부 모듈 import 가능. usecase/service 등은 자체 outbound port에만 의존.

```ts
// adapter/yyy.access.adapter.ts ✅ — 외부 import OK
import type { IYyyRepository } from "~yyy/public/iservice/yyy.repository.iservice.js";

// service/xxx.service.ts ❌ — 외부 모듈 import 금지
// usecase 도 마찬가지
```

### 예외: composition root
`main/presentation/app.module.ts` 와 `main/presentation/database/typeorm.database.module.ts` 만 모든 모듈을 wiring할 수 있음.

---

## NestJS Module 등록 패턴

```ts
// <module>/<module>.module.ts
@Module({})
export class XxxModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: XxxModule,
            global: true,                                 // ← 5개 모듈 전부 global 등록
            imports: [
                TypeOrmModule.forFeature([XxxEntity, /* ... */]),
                databaseModule,
            ],
            controllers: [XxxController],
            providers: [
                // Repository / Service / Subscriber
                XxxRepository,
                XxxLifecycleService,
                XxxSubscriber,

                // Outbound adapters (외부 wrap)
                YyyAccessAdapter,
                ZzzNotificationAdapter,

                // Use cases
                EnsureXxxUseCase,
                EndXxxUseCase,

                // Public iservice 바인딩 — service가 iservice 구조 만족 시 직결
                { provide: XXX_LIFECYCLE, useExisting: XxxLifecycleService },

                // Outbound port 바인딩 — adapter가 port 구현
                { provide: YYY_ACCESS_PORT, useExisting: YyyAccessAdapter },
                { provide: ZZZ_NOTIFICATION_PORT, useExisting: ZzzNotificationAdapter },
            ],
            exports: [XXX_LIFECYCLE /* 외부에 노출할 토큰만 */],
        };
    }
}
```

### Cross-module token 재매핑 (legacy 마이그레이션 패턴)

레거시 코드가 특정 token (`RULE_REPOSITORY_TOKEN`, `TURN_REPOSITORY_TOKEN` 등)을 통해 repository를 inject할 때, 새 모듈이 그 token을 자기 TypeORM repo로 remap하면 호출부 변경 없이 마이그레이션 가능하다.

```ts
// rule.module.ts
imports: [TypeOrmModule.forFeature([RuleEntity]), databaseModule, verificationModule],
providers: [
    RuleRepository,                                                  // 새 TypeORM repo
    { provide: RULE_REPOSITORY_TOKEN, useExisting: RuleRepository }, // ← legacy token 재매핑
    /* ... */
],
exports: [RULE_READ, RULE_WRITE, RULE_SIGNATURE_QUERY, RULE_REPOSITORY_TOKEN],  // ← 외부 노출
```

→ verification 모듈의 factory binding (`useFactory: (ruleRepo: IRuleRepository, ...) => new ...`) 이 자동으로 새 TypeORM repo를 받음. 점진적 migration이 끝나면 token alias를 제거.

### Factory binding 과도기 패턴

레거시 service / usecase 클래스가 positional constructor를 받고 `@Injectable` / `@Inject` 데코레이터가 없는 경우, 곧바로 `@Injectable` 변환하지 않고 module 내부에서 `useFactory` 로 DI 인자를 mapping 한다:

```ts
{
    provide: TurnEvaluationService,
    useFactory: (ruleRepo: IRuleRepository, turnRepo: ITurnRepository, verdictRepo: IVerdictRepository) =>
        new TurnEvaluationService(ruleRepo, turnRepo, verdictRepo),
    inject: [RULE_REPOSITORY_TOKEN, TURN_REPOSITORY_TOKEN, VERDICT_REPOSITORY_TOKEN],
}
```

→ 점진적으로 `@Injectable` + `@Inject(...)` 로 변환. 그 사이에도 module은 작동.

---

## 빌드 / 런타임 요구사항

### Decorator metadata (필수)

NestJS DI 는 `design:paramtypes` reflection metadata 를 의존한다. tsup/tsx 의 esbuild 만으로는 이걸 emit 하지 않으므로 SWC 가 반드시 필요하다.

| 영역 | 필요 패키지 | 설정 |
|---|---|---|
| **Build (`tsup`)** | `@swc/core` (server devDep) | tsup이 자동으로 SWC plugin 활성화 |
| **Dev (`node --watch`)** | `@swc-node/register` (root devDep) | `dev:server` 스크립트가 `--import @swc-node/register/esm-register` 사용 |

확인: `grep -c "design:paramtypes" packages/server/dist/chunk-*.js` — 0이면 metadata 누락 (build 깨짐).

### NestFactory.create logger

```ts
NestFactory.create(AppModule.forRoot(...), { logger: ["error", "warn"] })
```

`logger: false` 로 두면 DI 실패가 silently `process.exit(1)` 으로 묻힌다. 최소 `["error", "warn"]` 유지.

---

## dep-cruiser 규칙 템플릿

새 모듈 추가 시 `.dependency-cruiser.cjs` 의 `forbidden` 배열에 **모듈명만 치환**해서 복사. (`<module>` → `task`, `verification` 등)

```js
// ── <module> feature module 레이어 규칙 ─────────────────────────
{
    name: "<module>-domain-no-upward",
    severity: "error",
    comment: "<module>/domain은 가장 안쪽 — 다른 layer import 금지",
    from: { path: "^packages/server/src/<module>/domain/" },
    to: { path: "^packages/server/src/<module>/(repository|service|application|adapter|api|subscriber|public)/" },
},
{
    name: "<module>-repository-only-domain",
    severity: "error",
    from: { path: "^packages/server/src/<module>/repository/" },
    to: { path: "^packages/server/src/<module>/(service|application|adapter|api|subscriber)/" },
},
{
    name: "<module>-service-no-upper-layers",
    severity: "error",
    comment: "service는 outbound port (application/outbound)만 application 안에서 import 가능",
    from: { path: "^packages/server/src/<module>/service/" },
    to: {
        path: "^packages/server/src/<module>/(application|adapter|api|subscriber)/",
        pathNot: "^packages/server/src/<module>/application/outbound/",
    },
},
{
    name: "<module>-usecase-no-direct-repository",
    severity: "error",
    comment: "usecase는 service를 거쳐 repository에 접근",
    from: { path: "^packages/server/src/<module>/application/" },
    to: { path: "^packages/server/src/<module>/repository/" },
},
{
    name: "<module>-usecase-no-upper-layers",
    severity: "error",
    from: { path: "^packages/server/src/<module>/application/" },
    to: { path: "^packages/server/src/<module>/(adapter|api|subscriber)/" },
},
{
    name: "<module>-api-only-application",
    severity: "error",
    comment: "api는 application + domain (const/type) 만 — service/repository/adapter 는 금지",
    from: { path: "^packages/server/src/<module>/api/" },
    to: { path: "^packages/server/src/<module>/(service|repository|adapter|subscriber)/" },
},
{
    name: "<module>-adapter-no-application-internals",
    severity: "error",
    comment: "adapter는 outbound port contract(application/outbound)만 import 가능",
    from: { path: "^packages/server/src/<module>/adapter/" },
    to: {
        path: "^packages/server/src/<module>/(application|api|subscriber)/",
        pathNot: "^packages/server/src/<module>/application/outbound/",
    },
},
{
    name: "<module>-public-only-domain-types",
    severity: "error",
    from: { path: "^packages/server/src/<module>/public/" },
    to: { path: "^packages/server/src/<module>/(service|repository|application|adapter|api|subscriber)/" },
},
{
    name: "external-only-via-<module>-public",
    severity: "error",
    comment: "외부 모듈은 ~<module>/public 만 접근 가능",
    from: {
        path: "^packages/server/src/(?!<module>/)",
        pathNot: "^packages/server/src/main/presentation/(app\\.module|database/typeorm\\.database\\.module)\\.ts$",
    },
    to: { path: "^packages/server/src/<module>/(?!public/)" },
},
```

검증:
```bash
npm run lint:deps
npx depcruise --output-type dot --include-only "^packages/server/src/<module>" packages | dot -T svg > <module>-deps.svg
```

---

## 도메인 모델 (`*.model.ts`)

`*.entity.ts`(TypeORM 매핑, 영속화 대상)와 구분되는 **순수 도메인 모델 클래스**. 다음 조건이면 별도 model로 정의:

- 여러 필드를 묶어 **상황(context)** 또는 **사건(event)** 을 나타내며
- 그 정보를 가지고 **비즈니스 판단/계산**이 필요할 때

→ "데이터를 받아서 결정하는 함수" 대신 **"데이터를 가진 객체가 결정 메서드를 노출"**.

### 안 좋은 예 (functional, 결정이 외부에 흩어짐)
```ts
export interface DecisionInput { /* ... */ }
export function decide(input: DecisionInput): Decision { /* ... */ }
// 호출부: decide({ a, b, c, ... })
```

### 좋은 예 (model이 자기 정보로 판단)
```ts
// domain/<aggregate>.<event>.model.ts
export interface XxxEndProps { /* fields */ }

export class XxxEnd {
    readonly fieldA: TypeA;
    readonly fieldB: TypeB;
    // ...

    constructor(props: XxxEndProps) {
        this.fieldA = props.fieldA;
        // ...
    }

    /** 비즈니스 판단은 모델의 메서드. 외부 함수가 아님 */
    decide(): XxxEndDecision { /* this.* 로 판단 */ }

    private canX(): boolean { /* ... */ }
    private shouldY(): boolean { /* ... */ }
}
```

호출부:
```ts
const xxxEnd = new XxxEnd({ fieldA, fieldB, /* ... */ });
const decision = xxxEnd.decide();
```

### 특징
- 클래스이지만 **`@Injectable()`이 아님** — DI 컨테이너 밖, 호출 시점에 `new`로 생성
- 순수 in-memory — DB / I/O 의존 없음
- 테스트는 `new XxxEnd({...}).decide()` 만으로 충분 (mock 불필요)
- 같은 결정 로직이 여러 호출 지점에 흩어지는 걸 방지

### 언제 model 대신 그냥 함수로 충분한가
- 1~2개 인자만 받는 단순 query (예: `isTerminalTaskStatus(status)`)
- 도메인 사건/상황을 표현하지 않는 유틸리티

→ 그런 건 같은 model 파일이나 별도 helper 파일에 export 함수로 둠.

### 참고 구현
`packages/server/src/session/domain/runtime.session.end.model.ts` — runtime session 종료 상황을 표현하고 task 처리 결정을 내리는 model.

---

## Domain Event 처리 (TypeORM Subscriber)

`@Entity` 변경 시 events 테이블에 도메인 이벤트를 자동 기록하려면:

```ts
// subscriber/<module>.event.subscriber.ts
@Injectable()
@EventSubscriber()
export class XxxEntitySubscriber implements EntitySubscriberInterface<XxxEntity> {
    constructor(@InjectDataSource() dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }
    listenTo() { return XxxEntity; }

    async afterInsert(event: InsertEvent<XxxEntity>): Promise<void> {
        await event.manager.getRepository(EventLogEntity).insert({
            eventId: generateUlid(/* ... */),
            eventType: "xxx.created",
            payloadJson: JSON.stringify({ /* ... */ }),
            // ...
        });
    }
}
```

→ Service는 entity 저장만, subscriber가 사이드이펙트(이벤트 기록)를 자동 처리.

---

## 테스트 전략

| 대상 | mock 대상 | 위치 |
|---|---|---|
| usecase | service, outbound port | usecase 파일과 같은 폴더 (`*.usecase.test.ts`) |
| service | repository, outbound port | service 파일과 같은 폴더 (`*.service.test.ts`) |
| domain (pure) | 없음 | domain 파일과 같은 폴더 (`*.model.test.ts`) |
| subscriber | in-memory TypeORM `DataSource` | `subscriber/*.subscriber.test.ts` (integration) |
| adapter | 실제 외부 + DB integration | adapter와 같은 폴더 |

usecase / service 테스트는 outbound port를 `vi.fn()` 으로 mocking — 외부 모듈을 함께 띄울 필요 없음. domain 모델은 `new Xxx({...}).method()` 만으로 테스트 가능.

subscriber 테스트는 `new DataSource({ type: "better-sqlite3", database: ":memory:", entities: [...], synchronize: true })` 로 in-memory SQLite를 띄우고, subscriber 인스턴스를 직접 `new` 로 attach 해서 entity insert/update → events 테이블 검증.

**vitest 설정**: `packages/server/vitest.config.ts` 에서 `unplugin-swc` 를 사용해 decorator metadata를 emit. 테스트에서 entity / `@Injectable` 클래스를 직접 인스턴스화 하려면 SWC transform이 필수.

참고:
- `packages/server/src/task/domain/task.upsert.draft.model.test.ts` — pure domain model 테스트
- `packages/server/src/task/domain/task.relations.model.test.ts` — entity collection → snapshot 변환 테스트
- `packages/server/src/task/service/task.management.service.test.ts` — repository / outbound port 모두 mock한 service 단위 테스트
- `packages/server/src/task/subscriber/task.event.subscriber.test.ts` — in-memory DataSource로 subscriber integration 테스트

---

## Microservice 전환 시 변화 (예측 가능성)

이 구조의 장기 가치: 모듈을 별도 서비스로 떼어낼 때 **business logic 코드는 한 줄도 안 바뀜**.

| 영역 | Monolith | Microservice |
|---|---|---|
| `domain/`, `service/`, `repository/`, `application/usecase/` | 그대로 | **그대로** |
| `public/iservice/`, `public/dto/` | NestJS DI contract | **OpenAPI/protobuf schema** (그대로 export) |
| `public/tokens.ts` | DI 토큰 | (사용 안 함) |
| `api/` controllers | 외부 HTTP API | 외부 HTTP API + **public iservice를 endpoint로 노출하는 controller 추가** |
| 다른 모듈의 `adapter/<consumed>.adapter.ts` | in-process DI wrap | **HTTP/gRPC client로 교체** (port interface 동일) |

→ 즉 추출 작업은 **(a) iservice를 endpoint로 expose, (b) consumer adapter를 transport로 교체** 둘 뿐.

---

## 모듈 마이그레이션 / 신규 작성 체크리스트

신규 또는 레거시 → 모듈화 시:

- [ ] 폴더 구조 생성 (`common/`, `domain/`, `repository/`, `service/`, `application/{outbound,dto}/`, `adapter/`, `public/{iservice,dto}/`, `api/`, `subscriber/`)
- [ ] `<module>.module.ts` 작성 (Dynamic Module, `register` 패턴, `global: true`)
- [ ] `domain/*.entity.ts` (TypeORM @Entity, JPA 스타일)
- [ ] `domain/*.model.ts` (도메인 사건/상황을 표현하고 결정 메서드를 가지는 모델 — 필요한 만큼만)
- [ ] `common/` 분리 (errors / status const / slug helper 등 — domain은 비즈니스 의미만)
- [ ] `repository/` (TypeORM 기반 영속화 — thin, 도메인 결정 금지)
- [ ] `service/` (도메인 조합)
- [ ] `application/outbound/` (외부에서 받을 contract — self-contained, 외부 import 0)
- [ ] `adapter/` (outbound port 구현 — 외부 모듈 wrap)
- [ ] `public/iservice/` + `public/dto/` + `public/tokens.ts` (외부 노출용)
- [ ] `application/<*>.usecase.ts` (API endpoint 1:1, `execute(input)`)
- [ ] `api/<*>.controller.ts` + `<*>.schema.ts` (zod validation)
- [ ] `subscriber/` (필요 시 — entity lifecycle 이벤트, in-memory DataSource 통합 테스트)
- [ ] legacy token (`XXX_REPOSITORY_TOKEN`)을 새 TypeORM repo로 remap (`useExisting`) + exports에 token 포함
- [ ] `app.module.ts` 에 `<Module>.register(databaseModule)` 추가
- [ ] `.dependency-cruiser.cjs` 에 모듈 layer 규칙 9개 추가 (위 템플릿)
- [ ] tsconfig.json `paths` 에 `~<module>/*` 등록
- [ ] vitest.config.ts `resolve.alias` 에 `~<module>` 등록 (테스트에서 alias 사용 시)
- [ ] 검증: `npm run lint && npm run test && npm run lint:deps && npm run build`
- [ ] 부트스트랩 smoke: `node ./dist/...` 또는 `npm run dev:server` 가 listening 까지 도달
- [ ] (선택) `packages/server/dist/` 에서 `grep -c "design:paramtypes"` 가 > 0 인지 확인 (decorator metadata emit 검증)

---

## Reference Implementation

5개 모듈 모두 이 패턴의 reference 구현이지만, 각자 다른 측면을 잘 보여줌:

| 모듈 | 보여주는 것 |
|---|---|
| **`session/`** | 1차 reference. SessionLifecycleService = `useExisting`으로 ISessionLifecycle 직결. RuntimeBindingService = `useExisting`으로 IRuntimeBindingLookup. EventLogEntity 와 SessionEntitySubscriber. |
| **`task/`** | Repository thin (`listIdsByStatuses(statuses)`) + 도메인 모델 (`TaskRelations`, `TaskUpsertDraft`)이 결정을 소유. `common/` 분리. TaskEntitySubscriber + TaskRelationEntitySubscriber. |
| **`event/`** | 8개 entity + 6개 derived 테이블의 multi-table sync. FTS index / event-store append를 별도 outbound port로 분리. `EVENT_PERSISTENCE_PORT` + `EVENT_SEARCH_INDEX_PORT` + `EVENT_STORE_APPENDER_PORT` 합성. |
| **`rule/`** | Soft-delete 패턴 (`deleted_at IS NULL`). signature 변경 시 verdicts/enforcements invalidation을 verification 모듈의 public iservice로 위임. |
| **`verification/`** | Factory binding 과도기 패턴. 4개 entity + 4개 thin repository. 4개 public iservice (Backfill / VerdictCount / VerdictInvalidation / PostProcessor). 레거시 token 4개를 새 TypeORM repo로 remap. |
