# Deep Dive — Node.js vs Bun: 같은 JavaScript를 실행하는 두 런타임의 차이

> Phase 2에서 `node + tsx`, `node + 컴파일 JS`, `bun + .ts`, `bun + 컴파일 JS` 4개 경로를 모두 측정했고, 같은 JavaScript 산출물을 실행해도 Bun이 Node보다 약 30–40 % 빨랐다. 이 문서는 그 차이가 어디서 오는지를 엔진 / 런타임 / 표준 라이브러리 / TypeScript 처리 4축으로 분석한다.

핵심 결과 (n=200, median of 5 runs, 컴파일 JS 동일):

| Runtime | 실행 경로 | Median p99 | CPU avg | Memory avg |
|---|---|---:|---:|---:|
| Node.js 22 | `node + 컴파일 JS` | 77.70 ms | 98.24 % | 42.64 MiB |
| Bun 1 | `bun + 컴파일 JS` | **34.28 ms** | **84.86 %** | **41.36 MiB** |

같은 산출물(`dist/claude-code/hooks/*.js`)을 실행했는데 hook latency 56 % 단축, CPU 13 pp 감소.

> **메모리 차이가 작아진 점에 주의**: 이전 n=50 측정에선 Bun이 Node보다 메모리 40 % 적게 쓴다고 측정됐으나, n=200 재측정에선 차이가 1.3 MiB로 거의 동등 (42.64 vs 41.36). **이전 메모리 차이는 측정 sampling artifact일 가능성이 높음**. 실제 차이는 거의 없거나 매우 작음. CPU와 latency 차이는 일관되게 유지.

> ⚠️ **이 문서의 추론 한계**: 이 44% gap이 **어느 요인에서 얼마씩 왔는지를 분리 측정하진 않았다**. 가능한 후보(JS 엔진 startup, native 표준 라이브러리, ESM resolver, GC 전략, 모듈 캐시 등)를 아래에서 정리하지만, 각각의 기여도를 정량화하려면 별도 micro-benchmark가 필요하다. 아래 narrative는 대중적으로 알려진 두 런타임의 설계 의도와 일치하는 **plausible attribution**일 뿐, 이 측정 한 번으로 입증된 사실은 아니다.

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

### 1.2 short-lived process에서 두 엔진의 일반적인 평가 (대중적 narrative)

> 아래는 두 엔진의 설계 의도와 알려진 특성을 요약한 것이지, 우리 측정으로 입증된 attribution이 아님.

V8은 long-running server에서 JIT가 warmup된 뒤의 throughput을 극대화하도록 진화한 것으로 알려져 있다. TurboFan 같은 최적화 컴파일러는 함수가 "hot"으로 판정된 뒤에 깊은 최적화를 적용한다.

JSC는 Safari / iOS 같은 환경에서 **페이지 진입 첫 latency**가 중요한 환경에서 진화했고, 인터프리터(LLInt)와 베이스라인 JIT의 시작 비용을 줄이는 방향으로 알려져 있다.

Hook은 ~100 ms 안에 시작·실행·종료되어 JIT warmup이 의미 있게 일어나지 않는 구간이다. 이 구간에서 비용은 (어느 엔진이든) 다음에서 발생한다:
- 인터프리터 단계의 시작 오버헤드
- 표준 라이브러리의 첫 호출 비용
- 모듈 parse + bytecode 생성 속도

**우리 측정에서는 이 구간에서 Bun이 빨랐다는 사실만 관찰됐고, 그것이 JSC 자체 때문인지 / Bun 코어가 native라서인지 / ESM resolver 차이 때문인지는 분리 측정 안 함.** 위 narrative는 가설을 좁히는 도움 정도로만 받아들이면 된다.

### 1.3 우리가 실제로 관찰한 것

phase2-bun-js와 phase2-node-js의 median run에서 SessionStart hook의 p99 (n=200, 2026-05-05 sweep):

| Runtime | SessionStart p99 (median run) |
|---|---:|
| `node + 컴파일 JS` (phase2-node-js, 2026-05-05T02-53-52-499Z) | 95.2 ms |
| `bun + 컴파일 JS` (phase2-bun-js, 2026-05-05T03-45-49-128Z) | 40.8 ms |

두 측정은 **다른 시각의 다른 sweep run**에서 나온 값이라 baseline jitter
(287.54 vs 234.62 ms)가 영향을 줄 수 있음에 유의. 그래도 5 hook avg p99
기준 77.70 vs 34.28 ms (mean ± stddev: 209.27 ± 81.17 vs 137.69 ± 8.30)로
일관된 차이를 보였다. 이 차이의 원인 분리는 안 했지만 "warmup 후의
throughput 차이"로는 설명되지 않는다 (warmup 안 일어나는 구간이므로).

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

### 2.2 Zig 선택이 의미할 수 있는 것 (검증 안 된 narrative)

> 다시 말하지만 — 아래는 Bun의 공개된 설계 방향에서 추론한 plausible 이야기일 뿐이고, 우리 측정으로 입증된 게 아니다. 면접에서 정확히 attribution을 요구받으면 "측정으로 분리 안 했다"가 정직한 답이다.

Zig는 C 수준의 저수준 통제 + 명시적 allocator 모델을 가진 언어다. Bun 측 자료에 따르면:

- **arena allocator를 단계별로 쓴다**고 알려져 있음 (request-scoped, global pool, system malloc 분리). short-lived 작업은 종료 시 arena를 한꺼번에 free하므로 `free()` 호출 수가 줄 수 있음.
- **Bun core가 native에 가까움** — Node core는 많은 부분이 JS layer로 구현되어 있어 JS engine을 한 번 더 거치는 데 비해, Bun은 자주 호출되는 API (`fs`, `Buffer`, `JSON`)에 native fast path를 깔아 둔다고 공개 자료에 나옴.

이런 설계 차이가 우리 측정의 **56 % latency gap에 어느 정도 기여하는지는 분리 측정 없이는 알 수 없다**. 단지 "이런 설계 이유로 short-lived workload에서 차이가 날 수 있다는 가설은 그럴듯하다" 수준에 그친다.

### 2.3 메모리 비교 — n=200 재측정에서 차이가 거의 사라짐

같은 hook 작업에 사용된 컨테이너 메모리 (각 phase의 median run):

| 변종 | Memory avg | Memory max |
|---|---:|---:|
| `node + 컴파일 JS` | 42.64 MiB | 61.24 MiB |
| `bun + 컴파일 JS` | 41.36 MiB | 57.26 MiB |

**약 3 % 감소 (1.3 MiB 차이) — 사실상 동등**.

이전 n=50 측정 (단일 run)에서는 Bun이 Node보다 메모리 40 % 적게 쓴다고
관측됐으나 (34.39 vs 20.55 MiB), n=200 × 5 runs 재측정에서 그 차이가
사라짐. 이는 **이전 측정의 메모리 차이가 sampling artifact였을 가능성**을
시사한다 (Docker stats 폴링이 short-lived hook의 transient peak를
일관되게 포착하지 못함).

CPU 차이는 일관되게 유지: Node 98.24 % vs Bun 84.86 % — Bun이 같은 작업
처리에 약 13 pp 적은 CPU 사용. latency 차이도 일관: Node 77.70 vs Bun
34.28 ms.

남는 narrative: **Bun이 Node보다 latency·CPU 둘 다 적게 쓰지만 메모리는
거의 같다**. 메모리 narrative는 이전 측정 시점의 잘못된 attribution이고,
이번 round에서 정정된 부분.

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

| 변종 | Median p99 (n=200, 5 runs) | Δ |
|---|---:|---:|
| `node + tsx + .ts` (AS-IS, phase2-bun-ts sweep baseline) | 234.37 ms | 0 |
| `bun + .ts` | **41.26 ms** | **−82.4 %** |

### 3.2 컴파일 JS만 봤을 때

TypeScript transform 비용이 빌드 타임으로 옮겨졌다면, Node와 Bun의 차이는 순수 JS runtime의 차이만 남는다:

| 변종 | Median p99 |
|---|---:|
| `node + 컴파일 JS` | 77.70 ms |
| `bun + 컴파일 JS` | **34.28 ms** (−56 % vs node) |

이 43 ms 차이는 **JS 엔진 + 런타임 부트스트랩 + 표준 라이브러리 fast path**의 종합. Bun TS(41.26)보다 Bun JS(34.28)가 7 ms 더 빠른 것 → 같은 Bun 안에서도 TS syntax 처리 비용이 7 ms 정도 남아있음을 시사.

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

Agent Tracer **단일 사용자 self-hosted 권장 구성**:

```
런타임:    bun (RUNTIME=bun 일 때, 없으면 node)
실행 코드: 사전 컴파일된 ESM JS bundle
Transport: HTTP (UDS daemon은 multi-user 시 의미)
```

**이유**:
1. 가장 빠른 hook latency: **34.28 ms p99 (−85.4 % vs AS-IS)**
2. fallback이 있어서 Bun 미설치 환경에서도 동작 (컴파일 JS는 Node도 실행 가능, −73 %)
3. Hook process만 Bun이고 server는 Node 그대로 → server-side OTel/NestJS 호환 risk 없음
4. esbuild bundle 산출물이 Bun-Node 양쪽에서 동작하는 ESM JS이므로 한 산출물로 두 런타임 지원

**단계적 rollout 전략**:
- Step 1 (저위험): `node + 컴파일 JS`로 73 % 단축. plugin 사용자 환경에 추가 의존성 없음.
- Step 2 (선택적 fast path): 사용자가 Bun을 설치했고 `RUNTIME=bun`을 켜면 85 % 단축.
- Step 3 (multi-user 시): Phase 3 daemon — hook latency 단축은 없지만 server-side scalability 확보 (`deep-dive-uds-daemon.md` §8 참조).

---

## 6. 자주 나올 질문에 대한 답변

### Q. "Bun이 더 빠르면 왜 Bun을 기본으로 안 하나?"

배포 안정성. Hook은 사용자 환경에서 실행되는 코드이고, 사용자가 Bun을 설치하지 않았을 가능성이 충분히 있다. 컴파일된 JS는 Node와 Bun 둘 다 실행할 수 있으므로 **하나의 산출물로 두 런타임을 지원**하면서, Bun이 있으면 더 빠른 경로를 자동으로 타게 했다.

### Q. "Bun TS가 Node 컴파일 JS보다 빠른데 그러면 컴파일이 의미 없는 거 아닌가?"

Bun 내부에서도 TS syntax 처리 비용은 약 7 ms 남아있다 (Bun TS 41.26 vs Bun JS 34.28). 그리고 더 중요한 것은 **사용자 환경에 Bun이 없을 수 있다**는 점. Node 사용자에게도 73 % 단축을 주려면 컴파일 JS가 필요하다.

### Q. "JavaScriptCore가 V8보다 빠른가?"

**우리 측정 한 케이스에서는 이번 hook 워크로드 (short-lived) 안에서 Bun(JSC + Bun core)이 Node(V8 + Node core)보다 빨랐다는 사실만 관찰됨**. 두 엔진을 동일 조건에서 분리 측정하진 않았기 때문에 "JSC > V8"이 아니라 "Bun 런타임 > Node 런타임"이 정확한 표현. 일반적 narrative로는 long-running server에서는 V8이 TurboFan의 깊은 최적화로 throughput이 좋고, short-lived CLI에서는 JSC가 가벼운 시작 비용으로 유리하다고 알려져 있지만 — 이 일반 narrative와 우리 측정의 attribution을 직접 연결할 근거는 이 작업에서 만들지 않았다.

### Q. "Bun은 stable한가? production에서 써도 되나?"

1.0이 2023년 9월에 나왔고 현재 1.x. 핵심 API와 npm 호환성은 안정적이라고 알려져 있다. 다만:
- `worker_threads`, native addon, 일부 OTel 도구의 호환성은 여전히 가끔 broken (이슈 트래커에서 관측 가능)
- 빠른 development cadence라 minor 업데이트마다 동작이 미묘하게 바뀔 수 있음

**우리 프로젝트에서의 선택**: hook 같은 isolated short-lived process는 Bun을 채택. 메인 server runtime은 Node 그대로 — NestJS의 OTel auto-instrumentation 호환성 검증이 부담스러웠고, server는 long-lived라 Bun startup 우위가 amortize되어 동기가 약함.

### Q. "Bun이 Node보다 메모리를 적게 쓰지 않나?"

**n=200 재측정에서는 메모리 차이가 거의 사라짐** (Node 42.64 vs Bun 41.36 MiB). 이전 n=50 측정의 큰 차이 (34 vs 21 MiB)는 sampling artifact였을 가능성이 높음. 따라서 "Bun이 메모리도 적게 쓴다"는 narrative는 이번 측정으로는 뒷받침되지 않음.

CPU와 latency 차이는 일관됨:
- Node 컴파일 JS: 98% CPU avg, 77.70 ms p99
- Bun 컴파일 JS: 85% CPU avg, 34.28 ms p99

attribution은 여전히 분리 안 됨 (다음 round 우선순위).

---

## 7. 한 줄 요약

> **같은 컴파일 JS를 실행해도 Bun이 Node보다 hook p99을 56 % 줄였고 CPU avg도 13 pp 적게 썼다는 사실은 n=200 × 5 runs 측정으로 확인했다. 단, 이전 측정에서 보였던 큰 메모리 차이 (40 %)는 재측정에서 사라졌고 (1.3 MiB로 사실상 동등) 이는 이전 측정의 sampling artifact였음을 시사한다. 차이가 JS 엔진(JSC vs V8) / 런타임 stdlib (Bun native vs Node JS layer) / 모듈 시스템 중 어디에서 얼마씩 왔는지는 이번 작업에서 분리 측정 안 했고, 위 문서는 plausible attribution을 정리한 것이다. 채택 결정은 성능 단독이 아니라 호환성·배포 안정성과의 절충 — Agent Tracer는 "JS 산출물 한 개로 양쪽 런타임을 지원하고, Bun이 있으면 그쪽이 우선"의 구조를 골랐다.**
