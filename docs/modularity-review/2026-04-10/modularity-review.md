# Modularity Review

**Scope**: `packages/*` and `.claude/plugin/hooks/*` — full codebase  
**Date**: 2026-04-10

## Executive Summary

Agent Tracer는 Claude Code 중심의 로컬 에이전트 모니터링 서버 + 대시보드로, 런타임 훅에서 이벤트를 수집하고, 서버에 저장하며, MCP를 통해 에이전트가 접근할 수 있도록 하는 시스템이다. 현재 규모(단일 팀, 단일 런타임)에서는 전반적으로 충분히 동작하는 구조를 갖추고 있다. 그러나 세 가지 [불균형 커플링](https://coupling.dev/posts/core-concepts/balance/) 문제가 존재하며, 두 번째 런타임이 추가되거나 이벤트 종류가 늘어나는 순간 비용이 급증할 위치가 명확하다. 가장 심각한 문제는 훅 레이어에서 생산하는 `subtypeKey`/`toolFamily`/`operation` 등의 의미 메타데이터가 서버나 core를 통해 선언되지 않고 웹 레이어에서 암묵적으로 소비되는 것이다 — 이 계약은 코드 어디에도 명시적으로 정의되어 있지 않다.

## Coupling Overview Table

| Integration | [Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | [Distance](https://coupling.dev/posts/dimensions-of-coupling/distance/) | [Volatility](https://coupling.dev/posts/dimensions-of-coupling/volatility/) | [Balanced?](https://coupling.dev/posts/core-concepts/balance/) |
| --- | --- | --- | --- | --- |
| `.claude/plugin/hooks` → Server API (HTTP) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | High | ✅ Yes |
| `.claude/plugin/hooks/common.ts` (semantic inference) → `packages/web` (eventSubtype) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | High | High | ❌ **Critical** |
| Server application layer (`types.ts`, `EventLoggingService`) → Claude-specific capture semantics | [Functional](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low-medium | High | ❌ **Significant** |
| `packages/core` `RuntimeAdapterId` type → specific adapter name | [Intrusive](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | High | ❌ **Significant** |
| `common.ts` internal cohesion (mixed responsibilities) | Low | Low | High | ❌ **Significant** |
| `packages/mcp` → Server API (HTTP) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | Medium | ✅ Yes |
| `packages/server` → `packages/core` (types import) | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | Low | ✅ Yes |
| `packages/web` → `packages/core` (types import) | [Contract](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | Low | ✅ Yes |
| `ccSessionEnsureSchema` dead schema in `presentation/schemas.ts` | [Model](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/) | Low | Low | ⚠️ Minor debt |

---

## Issue: Implicit Semantic Metadata Contract Between Hook Layer and Web Layer

<div class="issue">

**Integration**: `.claude/plugin/hooks/common.ts` → `packages/web/src/lib/eventSubtype.ts`  
**Severity**: Critical

### Knowledge Leakage

`common.ts`의 `buildSemanticMetadata()`, `inferCommandSemantic()`, `inferExploreSemantic()`, `inferFileToolSemantic()` 함수들은 `subtypeKey`, `subtypeGroup`, `subtypeLabel`, `toolFamily`, `operation`, `entityType`, `entityName`, `sourceTool` 필드를 이벤트 메타데이터에 주입한다. `packages/web/src/lib/eventSubtype.ts`의 `SUBTYPE_DEFINITIONS` 딕셔너리와 `TimelineLaneRow` 구성 로직은 이 정확한 키 집합을 읽어 대시보드 UI를 렌더링한다.

이 계약은 `@monitor/core`에 선언된 타입 어디에도 존재하지 않는다. 두 파일은 완전히 독립된 패키지에 위치하면서 동일한 문자열 키 집합에 암묵적으로 의존한다. `subtypeKey: "read_file"`이라는 값이 두 파일 모두에 하드코딩되어 있으나, 이를 연결하는 공유 타입이나 인터페이스가 없다.

### Complexity Impact

개발자가 새 도구 종류를 추가하거나 기존 subtype 키를 리네임하면, 변경이 필요한 두 번째 위치(`eventSubtype.ts`)는 타입 에러가 발생하지 않는다 — `metadata`가 `Record<string, unknown>`이기 때문이다. 대신 대시보드는 조용히 폴백 렌더링으로 넘어가고, 의도한 subtype grouping이 사라진다. 이 실패는 런타임에만 관찰되고, 두 파일 간 [거리](https://coupling.dev/posts/dimensions-of-coupling/distance/)가 크기 때문에 원인 파악이 어렵다.

인지 부하 관점에서: 새 런타임 어댑터를 작성하는 개발자는 공통 타입에서 파악할 수 없는 `subtypeKey` 컨벤션을 별도로 학습해야 한다. 계약이 암묵적이기 때문에 어디서 배울 수 있는지도 불명확하다.

### Cascading Changes

새 런타임(예: Cursor, Windsurf)이 자체 도구 분류를 가져올 경우, 개발자는 다음을 동시에 수정해야 한다:
1. 새 런타임 어댑터의 `buildSemanticMetadata()` 호출 위치
2. `packages/web/src/lib/eventSubtype.ts`의 `SUBTYPE_DEFINITIONS`
3. `SUBTYPE_ORDER` 배열 (lane별 정렬 순서)

이 세 위치는 서로 다른 레이어(hook adapter, web lib)에 걸쳐 있으며 공통 타입이 없어 컴파일러가 누락을 감지하지 못한다.

### Recommended Improvement

`@monitor/core`에 semantic subtype 계약을 명시적 타입으로 올려야 한다:

```typescript
// packages/core/src/domain/event-subtype.ts
export type EventSubtypeKey =
  | "read_file" | "glob_files" | "grep_code" | "web_search" | "web_fetch"
  | "list_files" | "shell_probe" | "create_file" | "modify_file"
  | "delete_file" | "rename_file" | "apply_patch" | "run_command"
  | "run_test" | "run_build" | "run_lint" | "verify" | "rule_check"
  | "mcp_call" | "skill_use" | "delegation" | "handoff" | "bookmark";

export interface EventSemanticMetadata {
  readonly subtypeKey: EventSubtypeKey;
  readonly subtypeLabel: string;
  readonly subtypeGroup: string;
  readonly toolFamily: string;
  readonly operation: string;
  readonly entityType?: string;
  readonly entityName?: string;
  readonly sourceTool?: string;
}
```

그러면 `common.ts`는 이 타입에서 파생하고, `eventSubtype.ts`는 `EventSubtypeKey`를 키로 사용한다. 새 subtype 추가 시 타입 에러가 즉시 발생한다.

트레이드오프: core에 UI-facing 개념이 들어온다는 우려가 있을 수 있으나, subtype 계약은 UI가 아니라 이벤트 분류 도메인의 일부다 — core가 이미 `TimelineLane`과 `MonitoringEventKind`를 소유하는 것과 같은 근거다.

</div>

---

## Issue: Claude-Specific Capture Semantics Leak into Generic Server Application Layer

<div class="issue">

**Integration**: Server `application/types.ts` + `EventLoggingService` + `sqlite-event-repository.ts` → Claude plugin capture protocol  
**Severity**: Significant

### Knowledge Leakage

`TaskUserMessageInput`의 `captureMode: "raw" | "derived"` 필드와 `source: string` 필드는 Claude Code 훅 레이어의 캡처 방식에서 직접 유래했다. `"raw"`는 훅이 프롬프트를 직접 관찰했음을 의미하고, `"derived"`는 MCP 도구가 다른 이벤트로부터 합성했음을 의미한다.

이 구분은 세 곳에서 runtime-specific knowledge로 작동한다:
- `EventLoggingService.logUserMessage()`는 `captureMode`에 따라 분기한다
- `sqlite-event-repository.ts`는 `captureMode = 'raw'`를 직접 SQL 쿼리로 필터링한다
- `observability-task-analyzer.ts`는 `captureMode === "raw"` 조건으로 evidence를 측정한다

이 서버는 "어떤 런타임이 어떻게 캡처했는지"를 알아야 한다는 Claude-specific knowledge를 내재화하고 있다.

### Complexity Impact

두 번째 런타임(예: OpenCode, Codex)이 자체 캡처 의미론을 가져올 경우 — 예를 들어 "intercepted" vs "polled" — 이 새 런타임은 `captureMode: "raw" | "derived"` enum을 확장하거나, 기존 의미와 무관하게 `"raw"`로 매핑해야 한다. 두 경우 모두 서버의 application layer와 SQL 쿼리를 수정해야 한다.

`source` 필드 또한 마찬가지다: 현재 값은 `"claude-plugin"`이라는 런타임 식별자를 직접 전달한다. 서버가 이 문자열로 런타임을 식별하는 로직이 생기는 순간 [기능적 커플링](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/)이 형성된다.

### Cascading Changes

새 런타임 추가 시 예상 cascade:
1. `TaskUserMessageInput.captureMode` 타입 확장
2. `EventLoggingService` 분기 로직 수정
3. `countRawUserMessages()` SQL 쿼리 조건 재검토
4. `observability-task-analyzer` evidence 계산 로직 조정
5. 서버 스키마(`userMessageSchema`) 업데이트

이는 "서버 route만 늘리면 된다"는 기대와 달리, 서버의 핵심 application service와 인프라 쿼리까지 변경해야 한다는 것을 의미한다.

### Recommended Improvement

`captureMode`를 런타임 어댑터가 해결해야 할 문제로 취급하고, 서버의 application contract에서는 더 중립적인 개념으로 노출한다:

```typescript
// 현재
captureMode: "raw" | "derived"
source: string

// 개선 방향
observationMode: "direct" | "inferred"  // 런타임 중립 개념
capturedBy?: string                      // 투명한 출처, 분기 로직에 사용 금지
```

또는 더 단순하게: `captureMode`의 `"raw"/"derived"` 구분이 phase 계산(`"initial" | "follow_up"`)에만 쓰인다면, 훅 레이어에서 phase를 직접 계산하고 이미 있는 `phase` 필드를 통해 전달한다. 그러면 서버는 `captureMode`를 내부적으로 처리할 필요가 없다.

트레이드오프: 훅 레이어에서 message count를 계산하는 것은 무상태 프로세스에서는 어렵다. 현재 규모에서는 이 커플링을 허용 가능한 기술 부채로 유지하면서, `countRawUserMessages()`를 포트 인터페이스 뒤에 격리하는 것만으로도 충분한 방어선이 된다.

</div>

---

## Issue: `common.ts` Low Cohesion — Classification Logic Co-Located with Infrastructure

<div class="issue">

**Integration**: `common.ts` 내부 (단일 파일에 5가지 책임)  
**Severity**: Significant

### Knowledge Leakage

`.claude/plugin/hooks/common.ts`는 현재 다음 다섯 가지 책임을 하나의 525-line 파일에 담고 있다:

1. **HTTP transport** — `postJson`, `readStdinJson`
2. **Session cache I/O** — `getCachedSessionResult`, `cacheSessionResult`, `deleteCachedSessionResult`
3. **Semantic classification** — `inferCommandSemantic`, `inferExploreSemantic`, `inferFileToolSemantic`, `buildSemanticMetadata` (250+ lines)
4. **Subagent registry** — `readSubagentRegistry`, `writeSubagentRegistry`, `SubagentRegistry`
5. **Logging utilities** — `hookLog`, `hookLogPayload`

이 중 semantic classification은 가장 많은 변화가 발생하는 부분이다 — 새 도구 종류, 새 언어, 새 패턴마다 regex가 늘어난다. 그러나 이 로직은 transport, caching, logging과 같은 파일에 묶여 있어, 변경 범위를 파악하기 어렵고 테스트하기 어렵다.

### Complexity Impact

[낮은 응집도](https://coupling.dev/posts/core-concepts/balance/)는 직접적인 cascade를 만들지 않지만 인지 부하를 높인다. 개발자가 "Bash 커맨드 분류를 수정하고 싶다"고 할 때 525-line 파일의 어느 부분이 관련인지 즉각 파악하기 어렵다. 또한 classification 로직에 대한 단위 테스트가 없다 — transport와 묶여 있어 테스트 설정이 무거워지기 때문이다.

`SUBAGENT_REGISTRY_FILE`과 `SESSION_CACHE_DIR`는 `PROJECT_DIR` 기반 하드코딩 경로를 사용한다. 이 I/O 레이어가 classification 로직과 같은 파일에 있어, classification 함수를 테스트할 때 의도치 않게 파일 시스템 의존성이 생긴다.

### Cascading Changes

가장 일상적인 변경 시나리오: 새 셸 커맨드 패턴(예: `deno task`, `bun run`)을 인식하도록 `inferCommandSemantic`을 수정할 때, 개발자는 525-line 파일을 열고 transport/cache/registry 코드 사이에서 관련 regex를 찾아야 한다.

더 큰 변경 시나리오: 새 런타임 어댑터를 작성할 때, 이 런타임은 자체 semantic inference 로직이 필요할 수 있다. 현재 구조에서는 `common.ts`를 fork하거나, 불필요한 transport/cache 코드를 함께 가져와야 한다.

### Recommended Improvement

5개 책임을 4개 파일로 분리한다:

```
.claude/plugin/
├── lib/
│   ├── transport.ts       # postJson, readStdinJson
│   ├── session-cache.ts   # getCachedSessionResult, cacheSessionResult, ...
│   ├── subagent-registry.ts  # SubagentRegistry, readSubagentRegistry, ...
│   └── hook-log.ts        # hookLog, hookLogPayload
├── classification/
│   ├── command-semantic.ts    # inferCommandSemantic
│   ├── explore-semantic.ts    # inferExploreSemantic
│   └── file-semantic.ts       # inferFileToolSemantic
└── hooks/
    ├── common.ts          # 이제 lib/* re-export만 담음
    └── ...
```

이 분리의 가장 큰 이점은 `classification/*.ts`에 대한 독립 단위 테스트가 가능해진다는 것이다. 분류 로직은 순수 함수로 작성 가능하므로, 파일시스템이나 HTTP 의존성 없이 테스트할 수 있다.

트레이드오프: 훅 파일들의 import 경로가 길어지지만, TypeScript path alias로 해결 가능하다. 현재 단일 팀 + 단일 런타임에서는 긴급하지 않지만, 두 번째 런타임 어댑터가 생기기 전에 해두면 재사용 비용이 크게 줄어든다.

</div>

---

## Issue: `RuntimeAdapterId` Type Hardcodes Specific Runtime Name in Core

<div class="issue">

**Integration**: `packages/core/src/runtime-capabilities.types.ts` → `"claude-plugin"` literal  
**Severity**: Significant

### Knowledge Leakage

```typescript
// packages/core/src/runtime-capabilities.types.ts
export type RuntimeAdapterId = "claude-plugin";
```

Core의 타입 시스템이 현재 존재하는 유일한 런타임 이름을 literal union type으로 하드코딩한다. Core는 모든 패키지가 의존하는 계약 레이어인데, 이 계약이 특정 구현체 이름을 내재화하고 있다.

이와 연관된 `RuntimeCapabilities` 인터페이스는 런타임 중립적으로 잘 설계되어 있다 — `canCaptureRawUserMessage`, `canObserveSubagents` 등 기능 플래그로 능력을 추상화한다. 그러나 `adapterId` 필드의 타입이 `RuntimeAdapterId`로 제한되어 있어, 새 런타임을 등록하려면 core의 타입을 수정해야 한다.

### Complexity Impact

Core는 안정적인 계약 레이어여야 한다. 새 런타임 어댑터를 추가할 때마다 core를 수정해야 한다면, core의 버전 안정성이 떨어지고 server/mcp/web 패키지를 모두 재빌드해야 한다. 특히 `@monitor/core`가 npm publish되는 공개 패키지라면 이 문제는 더 심각하다.

### Cascading Changes

새 런타임 "opencode-plugin" 추가 시나리오:
1. `packages/core/src/runtime-capabilities.types.ts` 수정: `RuntimeAdapterId = "claude-plugin" | "opencode-plugin"`
2. core 재빌드 및 버전 bump
3. server, mcp, web 패키지 의존성 업데이트
4. `runtime-capabilities.defaults.ts`에 새 어댑터 등록

1~3은 단순히 어댑터를 등록하기 위해 core 패키지 전체를 건드린다는 점에서 불필요한 cascade다.

### Recommended Improvement

`RuntimeAdapterId`를 open string type으로 교체하되, branded type으로 안전성을 유지한다:

```typescript
// 현재
export type RuntimeAdapterId = "claude-plugin";

// 개선
export type RuntimeAdapterId = string & { readonly __brand: "RuntimeAdapterId" };

// 상수는 core에 남기되, type은 개방형으로
export const RUNTIME_ADAPTER_IDS = {
  CLAUDE_PLUGIN: "claude-plugin" as RuntimeAdapterId,
} as const;
```

이렇게 하면 `"claude-plugin"`이라는 문자열은 여전히 core에 상수로 존재하지만, 타입 자체는 새 어댑터를 추가해도 core를 수정할 필요가 없다.

트레이드오프: 현재 규모에서는 `"claude-plugin"` 하나만 있으므로 이 변경의 즉각적 이점이 작다. 그러나 두 번째 런타임이 추가되기 전에 처리해두면 core 패키지의 안정성을 보존할 수 있다.

</div>

---

## What Is Working Well

현재 규모에서 잘 작동하는 구조적 장점들을 명시한다.

**의존성 방향이 올바르다**: `web` → `core`, `server` → `core`, `mcp` → `server API`의 방향이 일관되게 유지된다. core가 다른 패키지를 역참조하는 경우가 없다.

**ports/adapters 경계가 잘 잡혀 있다**: `packages/server/src/application/ports/`의 포트 인터페이스들(`TaskRepository`, `EventRepository`, `NotificationPublisher` 등)은 application layer와 infrastructure를 깔끔하게 분리한다. SQLite 구현체를 교체할 수 있다.

**MonitorService façade가 적절한 위임을 한다**: `MonitorService`는 `TaskLifecycleService`, `EventLoggingService`, `WorkflowEvaluationService`로 책임을 위임하고, 자신은 thin coordinator 역할만 한다. 이 분리는 현재 규모에서 충분하다.

**훅 → API 방향이 올바르다**: 런타임 훅이 HTTP POST로 서버에 데이터를 밀어넣는 구조는 push model로서 옳다. 서버가 훅을 직접 의존하지 않는다.

**runtime capability registry가 확장 가능하다**: `registerRuntimeAdapter()`와 `registerDefaultRuntimeAdapters()` 구조는 새 런타임 어댑터를 플러그인 방식으로 등록할 수 있는 기반이다. 타입 문제(`RuntimeAdapterId`)만 해결되면 실질적으로 개방형 확장이 가능하다.

---

## Growth Risk Summary

현재는 괜찮지만 커질수록 고통이 커지는 축:

| 성장 시나리오 | 현재 영향 | 성장 시 영향 |
| --- | --- | --- |
| 새 런타임 어댑터 추가 | 거의 없음 | **Issue 1** (semantic contract), **Issue 3** (RuntimeAdapterId), **Issue 4** (common.ts fork) |
| 새 이벤트 subtype 추가 | 두 파일 수동 동기화 | **Issue 1** — 타입 에러 없이 UI 폴백 발생 |
| `captureMode` 의미 변경 | 국소적 수정 | **Issue 2** — SQL 쿼리, observability analyzer, application service 동시 수정 |
| `common.ts` 300→600 lines | 현재도 큰 편 | **Issue 3** — 더 이상 단위 테스트 불가 |

---

## Prioritized Refactor Suggestions

1. **[즉시]** `@monitor/core`에 `EventSemanticMetadata` 타입 및 `EventSubtypeKey` union 추가 → `common.ts`와 `eventSubtype.ts` 양쪽에서 이 타입을 import하도록 교체. 컴파일러가 누락을 감지하게 된다.

2. **[단기]** `common.ts`의 semantic inference 함수들을 `classification/` 디렉토리로 분리하고 단위 테스트 추가. classification 로직의 정확성을 검증하는 테스트가 현재 전무하다.

3. **[단기]** `RuntimeAdapterId`를 branded open string으로 교체. 두 번째 런타임 이전에 처리.

4. **[중기]** `captureMode: "raw" | "derived"` 를 훅 레이어에서 해소하거나, `phase` 필드로 통합 — 서버의 `countRawUserMessages()`를 더 중립적인 개념으로 교체.

5. **[기회적]** `ccSessionEnsureSchema` / `ccSessionEndSchema` 제거 — 어떤 컨트롤러에도 연결되지 않은 dead code.

---

_This analysis was performed using the [Balanced Coupling](https://coupling.dev) model by [Vlad Khononov](https://vladikk.com)._
