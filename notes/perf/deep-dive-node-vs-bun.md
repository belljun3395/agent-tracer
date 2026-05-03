# Deep Dive — Node.js vs Bun: 같은 JavaScript를 실행하는 두 런타임의 차이

> Phase 2에서 `node + tsx`, `node + 컴파일 JS`, `bun + .ts`, `bun + 컴파일 JS` 4개 경로를 모두 측정했고, 같은 JavaScript 산출물을 실행해도 Bun이 Node보다 약 30–40 % 빨랐다. 이 문서는 그 차이가 어디서 오는지를 엔진 / 런타임 / 표준 라이브러리 / TypeScript 처리 4축으로 분석한다.

핵심 결과 (median of 3 runs, 컴파일 JS 동일):

| Runtime | 실행 경로 | Avg hook p99 | CPU avg | Memory avg |
|---|---|---:|---:|---:|
| Node.js 22 | `node + 컴파일 JS` | 78.03 ms | 88.84 % | 34.39 MiB |
| Bun 1 | `bun + 컴파일 JS` | **43.73 ms** | **54.30 %** | **20.55 MiB** |

같은 산출물(`dist/claude-code/hooks/*.js`)을 실행했는데 hook latency 44 % 단축, CPU 35 pp 감소, 메모리 사용량 40 % 감소.

이 차이를 만드는 원인은 단일 요인이 아니라 4개 축의 합성이다.

---

## 1. JavaScript 엔진의 차이 — V8 vs JavaScriptCore

### 1.1 두 엔진은 무엇인가

| 항목 | Node.js | Bun |
|---|---|---|
| JS 엔진 | **V8** (Google) | **JavaScriptCore (JSC)** (Apple) |
| 사용처 | Chrome, Edge, Deno, Cloudflare Workers (V8 isolate) | Safari, WebKit |
| 구현 언어 | C++ | C++ |
| 라이선스 | BSD | LGPL/BSD 혼합 |
| JIT 단계 | Ignition(인터프리터) → SparkPlug(베이스라인) → Maglev → TurboFan(최적화) | LLInt(인터프리터) → Baseline JIT → DFG JIT → FTL JIT |
| 최고 처리량 (long-running) | 매우 높음 (20년+ 최적화 성숙도) | 높음 |
| Cold start | 상대적으로 느림 | **상대적으로 빠름** |

### 1.2 왜 short-lived process에서 JSC가 유리한가

V8은 server-side에서 압도적이지만 그 우위는 **JIT가 충분히 warmup된 뒤**에 나타난다. V8의 최적화 컴파일러(TurboFan)는 함수가 "hot"이라고 판단되어야 작동한다.

Hook은 100 ms 안에 시작·실행·종료된다. JIT warmup 자체가 일어날 시간이 거의 없다. 이 구간에서 중요한 것은:
- 인터프리터 단계의 **시작 오버헤드**
- 표준 라이브러리 (`fs`, `net`, `process`, `JSON`, …)의 **첫 호출 비용**
- 모듈 parse + bytecode 생성 속도

JSC는 이 영역에서 **인터프리터(LLInt)와 베이스라인 JIT의 시작 비용이 작도록 설계**되어 있다. Apple이 iOS / Safari에서 페이지 첫 진입 latency를 줄이는 게 우선이었기 때문에 startup-friendly로 진화한 결과물이다.

V8은 반대로 **장기 실행에서 throughput을 극대화**하도록 진화했다. 같은 함수를 천 번 호출하는 server-side 워크로드에선 V8이 (보통) 더 빠르지만, 함수가 한두 번 호출되고 끝나는 short-lived CLI에선 JSC의 가벼운 시작이 이긴다.

### 1.3 측정으로 드러난 부분

`SessionStart` 첫 호출 (cold) vs 이후 (warm)을 보면:

| Runtime | SessionStart p50 | p99 | max |
|---|---:|---:|---:|
| `node + JS` | ~95 ms | ~102 ms | ~106 ms |
| `bun + JS` | ~55 ms | ~58 ms | ~62 ms |

Bun이 p50과 p99 모두 일관되게 빠름. JIT warmup이 의미 있는 워크로드라면 p99가 p50보다 훨씬 클 텐데, 두 런타임 모두 p99-p50 갭이 작다 → JIT warmup이 중요한 영역이 아니라 **bootstrap이 중요한 영역**이라는 증거.

---

## 2. 런타임 구현 언어 — C++ vs Zig

### 2.1 표면적인 차이

| 항목 | Node.js | Bun |
|---|---|---|
| 런타임 구현 언어 | C++ | **Zig** |
| Event loop | libuv (C 기반) | 자체 구현 (Zig + 일부 C) |
| 모듈 시스템 | CommonJS / ESM (Node Compat 표기) | ESM 우선, CJS 호환 |
| 네이티브 binding | Node-API (N-API), C++ addon | bun:ffi, Node-API 호환 |
| Built-in tools | (없음) | bundler / package manager / test runner / transpiler 통합 |

### 2.2 Zig를 선택한 의미

Zig는 C에 가까운 저수준 통제를 제공하면서, allocator를 **명시적으로** 다루는 언어다. Bun이 빠른 이유 중 하나는:

- **할당자 인식 코드**: Bun 내부 코드가 단계별로 다른 allocator를 쓴다 (request-scoped arena, global pool, system malloc). short-lived 작업은 arena allocator로 처리하고 종료 시 한꺼번에 free → free() 호출 횟수 감소.
- **소형 함수 inline**: Zig의 컴파일러가 generic 코드를 monomorphize하면서 hot path의 함수 호출 오버헤드를 줄임.
- **표준 라이브러리 fast path**: `Buffer.from(string)`, `JSON.parse`, `fs.readFileSync` 같은 자주 호출되는 API에 Zig native fast path가 깔려 있음.

Node도 V8 native code를 쓰지만, Node 코어의 많은 부분이 JS layer로 구현되어 있어 JS engine을 한 번 더 거친다. Bun은 그런 wrapper layer를 더 적게 쓰도록 설계됐다.

### 2.3 메모리 비교 (실측)

같은 hook 작업에 사용된 컨테이너 메모리:

| 변종 | Memory avg | Memory max |
|---|---:|---:|
| `node + 컴파일 JS` | 34.39 MiB | 58.03 MiB |
| `bun + 컴파일 JS` | **20.55 MiB** | **36.30 MiB** |

40 % 감소. 이유:
- JSC heap이 V8 heap보다 작은 워크로드에서 효율적
- Bun이 자체 allocator로 단기 메모리 회수가 빠름
- Node core의 JS layer 모듈이 메모리를 잡지 않음 (Bun은 많은 부분이 native)

---

## 3. TypeScript 처리 방식 차이

### 3.1 Node + tsx vs Bun (native TS)

| 항목 | `node + tsx` | `bun` (native) |
|---|---|---|
| TS 실행 가능 여부 | ✗ (tsx loader 필요) | ✓ (런타임 기능으로 내장) |
| transform 도구 | tsx 내부 esbuild-wasm/native | **JavaScriptCore에 통합된 transpiler** |
| tsconfig 처리 | 매번 파싱 | 매번 파싱 (caching 있음) |
| path alias | tsx가 ESM resolver hook 등록 | bun의 자체 resolver가 처리 |
| 비용 위치 | tsx CLI 로드 → loader 등록 → transform | bun 인터프리터 fast path |

Bun의 native TS는 별도 CLI 로드가 없다. JSC의 토크나이저/파서가 직접 TS 토큰을 인식하고 dropped한다. `tsx`처럼 별도 transform pipeline을 거치지 않는다.

이 차이만으로:

| 변종 | Avg hook p99 |
|---|---:|
| `node + tsx + .ts` | 250.94 ms |
| `bun + .ts` | **48.81 ms** (−80.5 %) |

### 3.2 컴파일 JS만 봤을 때

TypeScript transform 비용이 빌드 타임으로 옮겨졌다면, Node와 Bun의 차이는 순수 JS runtime의 차이만 남는다:

| 변종 | Avg hook p99 |
|---|---:|
| `node + 컴파일 JS` | 78.03 ms |
| `bun + 컴파일 JS` | **43.73 ms** (−44 % vs node) |

이 34 ms 차이는 **JS 엔진 + 런타임 부트스트랩 + 표준 라이브러리 fast path**의 종합. Bun TS(48.81)보다 Bun JS(43.73)가 5 ms 더 빠른 것 → 같은 Bun 안에서도 TS syntax 처리 비용이 5 ms 정도 남아있음을 시사.

---

## 4. 표준 라이브러리와 호환성 — Bun을 채택할 때 검증해야 할 것

성능만 보면 Bun이 명확한 승자다. 하지만 hook은 **사용자 환경에 배포되어 실행되는 코드**이므로 호환성 risk를 평가해야 한다.

### 4.1 Node API 호환

Bun은 Node API 호환을 명시적 목표로 한다. `node:fs`, `node:net`, `node:crypto`, `node:child_process`, `node:os`, `node:path`, `process.*` 대부분이 그대로 동작한다.

그러나 다음 영역은 edge case가 있다:
- `node:vm`의 일부 옵션
- Native addon (`.node` 파일) — Node-API 호환은 있지만 prebuilt binary가 Node용
- `worker_threads` 일부 transferable / SharedArrayBuffer 동작
- `child_process.fork`의 IPC 경로 (Bun도 지원하지만 디테일 차이 존재)

Agent Tracer hook은 `fs`, `net`, `crypto`, `child_process.spawn`, `process.env`, `process.stdin`, `JSON.parse`/`stringify`, `fetch` 정도만 사용한다. 위험 영역에 거의 닿지 않는다.

### 4.2 ESM / CJS interop

Bun은 ESM 우선이다. Bun 안에서 CJS 모듈도 `require()`로 import할 수 있지만:
- `__dirname` / `__filename` 동작
- `package.json`의 `"exports"` conditional resolution
- `.cjs` / `.mjs` / `.js` (with `"type": "module"`)
의 미묘한 동작 차이가 있을 수 있음.

esbuild로 ESM bundle을 만들어 두면 (Agent Tracer는 그렇게 함) 이 문제는 거의 사라진다. bundle 단계에서 import graph가 한 형식으로 통일되어 buffered되기 때문.

### 4.3 OpenTelemetry 등 server-side instrumentation 호환

Server (NestJS)는 Bun으로 옮길 계획이 없다. OTel auto-instrumentation 패키지들은 `require-in-the-middle` / `import-in-the-middle` hooking에 의존하는데, Bun의 module resolver와 100 % 호환은 아직 검증 필요. **Hook process만 Bun**, 서버는 Node — 이 비대칭이 안전하다.

### 4.4 배포 환경 요구

Claude Code plugin으로 배포되므로 사용자 환경에 Bun을 설치하라고 요구해야 한다:

```bash
brew tap oven-sh/bun && brew install oven-sh/bun/bun
# or
curl -fsSL https://bun.sh/install | bash
```

이 추가 단계가 plugin 설치 진입 장벽이 된다. Hook의 `RUNTIME=bun` 환경 변수를 검사해서 **Bun이 있으면 Bun, 없으면 Node**로 fallback하는 구조가 적합하다.

---

## 5. 그래서 채택 결정은?

Agent Tracer Phase 2+3의 최종 구성은:

```
런타임:    bun (RUNTIME=bun 일 때, 없으면 node)
실행 코드: 사전 컴파일된 ESM JS bundle
Transport: UDS daemon
```

**이유**:
1. 가장 빠른 hook latency (41.93 ms p99)
2. fallback이 있어서 Bun 미설치 환경에서도 동작 (compile JS는 Node도 실행 가능)
3. Hook process만 Bun이고 server는 Node 그대로 → server-side OTel/NestJS 호환 risk 없음
4. esbuild bundle 산출물이 Bun-Node 양쪽에서 동작하는 ESM JS이므로 한 산출물로 두 런타임 지원

**단계적 rollout 전략**:
- Step 1 (저위험): `node + 컴파일 JS`로 70 % 단축. plugin 사용자 환경에 추가 의존성 없음.
- Step 2 (선택적 fast path): 사용자가 Bun을 설치했고 `RUNTIME=bun`을 켜면 80 %+ 단축.
- Step 3: Phase 3 daemon으로 hook latency floor 추가 단축 (process spawn 비용도 제거).

---

## 6. 자주 나올 질문에 대한 답변

### Q. "Bun이 더 빠르면 왜 Bun을 기본으로 안 하나?"

배포 안정성. Hook은 사용자 환경에서 실행되는 코드이고, 사용자가 Bun을 설치하지 않았을 가능성이 충분히 있다. 컴파일된 JS는 Node와 Bun 둘 다 실행할 수 있으므로 **하나의 산출물로 두 런타임을 지원**하면서, Bun이 있으면 더 빠른 경로를 자동으로 타게 했다.

### Q. "Bun TS가 Node 컴파일 JS보다 빠른데 그러면 컴파일이 의미 없는 거 아닌가?"

Bun 내부에서도 TS syntax 처리 비용은 약 5 ms 남아있다 (Bun TS 48.81 vs Bun JS 43.73). 그리고 더 중요한 것은 **사용자 환경에 Bun이 없을 수 있다**는 점. Node 사용자에게도 70 % 단축을 주려면 컴파일 JS가 필요하다.

### Q. "JavaScriptCore가 V8보다 빠른가?"

상황에 따라 다름. **Long-running server**에서는 V8이 보통 더 빠름 (TurboFan의 깊은 최적화). **Short-lived CLI**에서는 JSC가 보통 더 빠름 (가벼운 시작 비용). Hook은 명백히 후자.

### Q. "Bun은 stable한가? production에서 써도 되나?"

1.0이 2023년 9월에 나왔고 현재 1.x. 핵심 API와 npm 호환성은 안정적. 다만:
- `worker_threads`, native addon, 일부 OTel 도구의 호환성은 여전히 가끔 broken
- 빠른 development cadence라 minor 업데이트마다 동작이 미묘하게 바뀔 수 있음

**권장**: hook 같은 isolated short-lived process는 Bun이 매우 적합. 메인 server runtime을 Bun으로 옮기는 건 더 신중하게 검토 (full integration test 필수).

### Q. "Bun이 Node보다 메모리를 적게 쓰는데 왜?"

세 가지: (1) JSC heap이 V8 heap보다 가볍게 시작함. (2) Bun core가 native(Zig)이라 JS heap에 덜 의존. (3) Bun이 단명 객체에 arena allocator를 써서 GC 부담이 적음. 메모리 우위는 Phase 2+3 결합에서도 일관 — `bun + JS + UDS daemon`이 단순 `node + tsx`보다 메모리 30 % 적게 씀.

---

## 7. 한 줄 요약

> **같은 컴파일 JS를 실행해도 Bun이 Node보다 hook p99를 44 % 줄이는 것은 JavaScript 코드 자체가 다르게 실행되기 때문이 아니라, "JS 엔진의 시작 비용 + 런타임 표준 라이브러리의 native fast path + 모듈 시스템 부트스트랩"이 short-lived 프로세스에서 다르게 작동하기 때문이다. 결정은 성능 단독이 아니라 호환성과 배포 안정성을 함께 본 절충 — Agent Tracer는 "JS 산출물 한 개로 양쪽 런타임을 지원하고, Bun이 있으면 그쪽이 우선"의 구조를 골랐다.**
