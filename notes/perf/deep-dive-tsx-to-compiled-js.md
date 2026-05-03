# Deep Dive — tsx 런타임 트랜스파일을 esbuild 사전 컴파일 JS로 바꾸면 왜 hook latency가 감소하는가

> Agent Tracer Phase 2의 핵심 변경: Claude Code hook entry를 매 호출마다 `tsx`로 즉석 실행하는 구조에서, 빌드 시점에 `esbuild`로 `dist/claude-code/hooks/*.js`를 만들고 런타임에는 `node dist/...js` 또는 `bun dist/...js`를 실행하는 구조로 전환.

핵심 결과 (median of 3 runs, Docker 1 vCPU/256 MiB 컨테이너):

| 변종 | Avg hook p99 | Δ vs AS-IS |
|---|---:|---:|
| AS-IS — `node + tsx + .ts` | 250.94 ms | 0 |
| `node + 컴파일 JS` | 78.03 ms | **−70.5 %** |
| `bun + .ts` (native TS) | 48.81 ms | −80.5 % |
| `bun + 컴파일 JS` | 43.73 ms | **−82.7 %** |

이 문서는 **왜** 이 차이가 나는지를 단계별로 설명한다. Bun과 Node의 런타임 차이는 [`deep-dive-node-vs-bun.md`](deep-dive-node-vs-bun.md)에서 별도로 다룬다.

---

## 1. 먼저 분리해야 할 두 가지 오해

### 오해 1: "TypeScript 자체가 느리다"

아니다. TypeScript는 결국 빌드 시점에 JavaScript로 변환되어 V8(또는 JavaScriptCore)이 실행한다. 변환 결과 JavaScript의 성능은 일반 JS와 동일하다.

이번 개선의 병목은 **TypeScript를 "런타임에" JavaScript로 변환하고, 그 변환기를 "매번" 새 프로세스에서 부팅하는 구조**에 있다.

### 오해 2: "그냥 Node를 한 번 띄우면 되지 않나"

Claude Code hook은 long-running server가 아니다. `SessionStart`, `PreToolUse`, `PostToolUse`, `StatusLine` 같은 이벤트마다 **새 프로세스로 짧게 실행되고 종료**된다. 1회 startup overhead가 그대로 사용자 critical path에 들어간다.

웹 서버라면 startup 비용 1초도 amortize되어 의미 없지만, hook은 호출 빈도가 높고 (분당 수십 회), 평균 실행 시간이 100 ms 단위이므로 startup 비용이 latency의 80 %+를 차지한다.

---

## 2. JS 엔진은 무엇을 실행할 수 있나 — TypeScript ≠ JavaScript

### 2.1 V8(Node) / JavaScriptCore(Bun) 모두 실행할 수 있는 것
ECMAScript 표준에 정의된 JavaScript syntax. 즉:
- `let`, `const`, `function`, `class`, `=>`
- `import`, `export`(ES Modules)
- `async`/`await`
- ECMAScript 표준 객체 (`Map`, `Set`, `Promise`, `Array`, …)

### 2.2 둘 다 실행할 수 없는 것 (TypeScript 전용 syntax)
- 타입 어노테이션: `function foo(x: number): string`
- 인터페이스: `interface Foo { ... }`
- 타입 별칭: `type Bar = string | number`
- 제네릭: `function foo<T>(x: T)`
- 접근 제어자: `private`, `public`, `readonly`
- `as` 타입 단언, `satisfies`, `enum`, `namespace`
- type-only import: `import type { Foo } from "..."`

이 토큰들이 들어 있는 `.ts` 파일을 그대로 `node`에 넘기면 SyntaxError가 난다.

### 2.3 결국 `.ts`를 실행하려면 둘 중 하나
| 방식 | 변환 시점 | 도구 |
|---|---|---|
| **사전 컴파일** | 배포/빌드 시점 | `tsc`, `esbuild`, `swc`, `rollup`, `vite build` |
| **런타임 트랜스파일** | 매 실행 시점 | `tsx`, `ts-node`, `node --loader ...`, **bun (native)** |

웹 서버처럼 한 번 뜨고 오래 살아 있는 프로세스는 어느 쪽이든 큰 차이 없다. 짧고 자주 실행되는 CLI/hook은 **사전 컴파일**이 압도적으로 유리하다.

---

## 3. AS-IS 실행 경로 — 매 hook 호출마다 tsx가 하는 일

기존 hook runner의 핵심 한 줄:

```bash
# packages/runtime/src/claude-code/bin/run-hook.sh (AS-IS)
exec node "$TSX" --tsconfig "$TSCONFIG" "$HOOK_FILE"
```

Claude Code가 hook 이벤트를 발생시킬 때마다 다음 흐름이 처음부터 끝까지 반복된다:

```
Claude Code (외부 프로세스)
  └─ spawn run-hook.sh
       ├─ bash 시작 (PATH 탐색, builtin 초기화)
       ├─ hook 경로 / tsx 경로 resolve
       └─ exec node tsx/dist/cli.mjs --tsconfig tsconfig.json hook.ts
            │
            │  (이 시점부터가 "프로세스당 매번 반복되는 비용")
            │
            ├─ ① Node.js 프로세스 부트스트랩
            │    - V8 isolate 생성, GC, JIT 초기화
            │    - 기본 모듈 (fs, path, crypto, ...) 로드
            │    - ESM loader 준비
            │    - process / env / stdin / stdout 설정
            │
            ├─ ② tsx CLI 로드
            │    - tsx/dist/cli.mjs 파일 읽기 + parse + evaluate
            │    - tsx 내부 transform pipeline 셋업
            │    - source-map 처리 모듈 초기화
            │
            ├─ ③ tsconfig 파싱
            │    - tsconfig.json (또는 tsconfig.plugin.json) 디스크에서 읽기
            │    - JSON parse + extends 체인 따라가기
            │    - compilerOptions.paths / baseUrl 해석
            │
            ├─ ④ ESM/TS loader 등록
            │    - node:module register hook 호출
            │    - .ts 확장자 → transform 라우팅 등록
            │
            ├─ ⑤ Entry .ts 파일 transform
            │    - 디스크에서 SessionStart.ts 읽기
            │    - TypeScript 토큰 제거 (타입 어노테이션, interface, ...)
            │    - JSX/TSX 처리 (있다면)
            │    - source-map 생성
            │
            ├─ ⑥ Import graph 탐색 + 매 module마다 ⑤ 반복
            │    - import "~shared/transport"  → path alias 해석 →
            │      packages/runtime/src/shared/transport.ts 찾기 → transform → evaluate
            │    - 그 module이 또 import한 module들도 같은 과정
            │
            └─ ⑦ 마침내 hook business logic 실행
                 - JSON.parse(process.stdin)
                 - postJson("/ingest/v1/events", payload)
                 - process.exit(0)
```

**중요한 관찰**: hook의 비즈니스 로직(⑦)이 1–5 ms로 끝나도, ①~⑥의 고정비가 100 ms+이면 사용자가 체감하는 hook 비용은 100 ms+이다.

### 3.1 tsx CLI 로드 비용이 매번 발생하는 이유

`tsx`는 TypeScript transform + ESM loader를 wrapping한 CLI다. 내부적으로 (대략):

```
tsx/dist/cli.mjs
  ├─ esbuild-wasm 또는 native esbuild 바이너리
  ├─ chokidar (watch 모드용; CLI 모드에선 미사용이지만 require 그래프엔 있음)
  ├─ source-map-support
  └─ Node ESM loader hook 등록
```

이 모든 것이 **매 hook 호출마다** parse/evaluate된다. OS page cache가 데워져 디스크 I/O는 빨라지지만, **JS module parse + evaluate 비용은 프로세스마다 새로 발생**한다 — V8 caching 옵션 (`--use-bytecode-cache`)을 쓰지 않는 한.

### 3.2 tsconfig 파싱과 path alias 해석

Agent Tracer runtime은 path alias를 사용한다:

```ts
// 소스
import { runHook } from "~shared/hook-runtime/run-hook";
import { readSessionStart } from "~shared/hooks/claude/payloads";
```

Node 자체는 `~shared`라는 import specifier를 모른다. tsx가 매 호출마다:
1. `tsconfig.plugin.json`을 읽어서 `compilerOptions.paths`를 본다
2. `~shared/*` → `packages/runtime/src/shared/*`로 매핑한다
3. ESM resolver hook에 alias resolution을 등록한다
4. 모든 import specifier에서 alias를 실제 경로로 치환한다

**사전 컴파일 JS에서는 alias가 빌드 시점에 이미 실제 상대/절대 경로로 해소된다.** 런타임에는 일반 ESM module path만 남는다.

### 3.3 Import graph 크기에 비례하는 비용

`SessionStart.ts` 한 파일을 실행해도 실제 의존성 그래프는 훨씬 크다:

```
SessionStart.ts
├─ ~shared/hook-runtime/run-hook.ts
├─ ~shared/hooks/claude/payloads.ts
├─ ~shared/transport/transport.ts
│   ├─ ~shared/config/env.ts
│   ├─ ~shared/routing/ingest.routing.ts
│   ├─ ~shared/errors/monitor.ts
│   └─ ~shared/semantics/tags.ts
├─ ~shared/events/kinds.type.ts
├─ ~shared/observability/hook-log.ts
└─ ... (수십 개 internal module)
```

tsx 방식은 이 그래프를 **실행 시점에 한 노드씩 따라가며** transform + alias resolve + evaluate한다. 캐시(`tsx`는 `node_modules/.cache`에 transform 결과를 캐싱)가 있어도 short-lived process에서는 cache lookup 자체도 비용이고, cache hit이라도 module을 다시 parse + evaluate해야 한다.

`esbuild --bundle`은 이 그래프를 **빌드 시점에 한 번 분석**하고, 각 hook entry별로 **하나의 자급자족 JS bundle**로 만든다. 런타임에는 그래프를 따라가지 않고 `node` 또는 `bun`이 단일 JS 파일을 읽어 실행한다.

---

## 4. TO-BE 실행 경로 — 빌드 타임에 비용을 선납하고 런타임에는 `node`만 실행

Agent Tracer의 `packages/runtime/build.ts`:

```ts
import { build } from "esbuild";

await build({
    entryPoints,         // 56개 hook entry (.ts)
    outbase: hooksRoot,
    outdir,              // dist/claude-code/hooks/
    bundle: true,        // import graph 를 하나의 JS로 묶음
    platform: "node",
    target: "node20",    // 사용 가능한 ES feature 의 상한선
    format: "esm",
    sourcemap,           // 디버깅용
    packages: "external",// npm 패키지는 bundle 안 함 (5절 참조)
    tsconfig: path.join(runtimeRoot, "tsconfig.plugin.json"),
    alias: {
        "~shared":      path.join(runtimeRoot, "src/shared"),
        "~claude-code": path.join(runtimeRoot, "src/claude-code"),
    },
});
```

`run-hook.sh`는 compiled JS가 있으면 그걸 우선 실행:

```bash
COMPILED_HOOK_FILE="${PLUGIN_ROOT}/dist/claude-code/hooks/${HOOK_NAME}.js"

if [ -f "$COMPILED_HOOK_FILE" ]; then
  if [ "${RUNTIME:-}" = "bun" ]; then
    exec bun "$COMPILED_HOOK_FILE"     # bun runtime
  else
    exec node "$COMPILED_HOOK_FILE"    # node runtime
  fi
fi

# fallback: 컴파일 산출물이 없으면 기존 tsx 경로
exec node "$TSX" --tsconfig "$TSCONFIG" "$HOOK_FILE"
```

런타임 흐름이 이렇게 짧아진다:

```
Claude Code
  └─ spawn run-hook.sh
       ├─ bash 시작
       ├─ compiled JS 경로 resolve
       └─ exec node dist/claude-code/hooks/SessionStart.js
            ├─ ① Node.js 프로세스 부트스트랩
            ├─ ② JS bundle parse + evaluate
            └─ ③ hook business logic 실행
```

**제거된 작업** (모든 ②~⑥):

| 단계 | AS-IS (tsx) | TO-BE (compiled JS) |
|---|---|---|
| tsx CLI parse + evaluate | 매 호출 | **없음** |
| tsconfig 파싱 | 매 호출 | 빌드 시 1회 |
| TS syntax transform | 매 호출 | 빌드 시 1회 |
| path alias 해석 | 매 호출 | 빌드 시 1회 |
| Import graph 탐색 | 매 호출 (수십 module) | 빌드 시 1회, 런타임엔 단일 JS |
| 여러 internal module 디스크 I/O | 매 호출 | bundle 1개 read |

---

## 5. `bundle: true`의 의미 — 단순 transpile만으로는 부족한 이유

`tsc`만 사용해도 `.ts → .js` 변환은 된다. 하지만 그 결과는 `1:1` 파일 매핑이다:

```
src/claude-code/hooks/SessionStart.ts → dist/claude-code/hooks/SessionStart.js
src/shared/transport.ts                → dist/shared/transport.js
src/shared/config/env.ts               → dist/shared/config/env.js
... (수십 개)
```

이 경우 런타임에서:
- TS transform 비용은 사라짐 ✓
- **그러나** Node가 여전히 import graph를 따라가며 수십 개 JS 파일을 resolve / read / parse / evaluate해야 함

short-lived process에서는 module loading 비용도 무시 못 한다. `esbuild --bundle`은 entry 하나에 internal dependency를 모두 합쳐 단일 JS 파일로 만든다:

```
SessionStart.ts + ~shared/* + ~claude-code/* → dist/claude-code/hooks/SessionStart.js  (단일 파일)
```

런타임 module resolution과 디스크 I/O가 1회로 줄어든다.

### 5.1 `packages: "external"`의 trade-off

Agent Tracer는 **internal code만** bundle하고 외부 npm 패키지는 외부로 둔다:

```js
packages: "external"   // node_modules/* 는 bundle하지 않음
```

이유는 절충:

| 외부 패키지 처리 | 장점 | 단점 |
|---|---|---|
| **External (현재)** | bundle 작음, license/compat 안전, native module 문제 없음 | 런타임에 `node_modules/`에서 패키지 resolve 비용 발생 |
| All inline (`packages: undefined`) | 런타임 resolution 0 | bundle 거대, 일부 native module이나 conditional exports 깨짐 |

Agent Tracer hook은 외부 의존성이 적어 (transport / OTel 정도) external 비용이 작다. 만약 hot path hook의 외부 의존성이 늘면 selective bundling을 검토할 수 있다.

---

## 6. 왜 `esbuild`를 골랐나

| 후보 | TS transform | Bundle | Path alias | Node target | typecheck |
|---|---|---|---|---|---|
| `tsc` | ✓ | ✗ | ✓ (별도 처리 필요) | ✓ | **✓** |
| `esbuild` | ✓ (빠름) | **✓** | ✓ | ✓ | ✗ |
| `swc` | ✓ (빠름) | △ (별도 bundler 필요) | ✓ | ✓ | ✗ |
| `rollup` | △ (plugin) | ✓ | ✓ | ✓ | ✗ |
| `tsup` | ✓ (esbuild wrapper) | ✓ | ✓ | ✓ | ✗ |

핵심 요구:
1. **bundling이 필수** — 런타임 module graph 비용 제거를 위해
2. **alias 설정이 직관적** — `~shared`, `~claude-code` 매핑
3. **Node target 명시 가능** — node20 ESM
4. **CI에서 빠른 빌드** — 56개 hook entry × 매 PR

→ esbuild가 정확히 fit. typecheck는 별도 pipeline에서 (`tsc -p tsconfig.json --noEmit` + `vitest` + `eslint`).

---

## 7. fallback을 유지한 이유

```bash
if [ -f "$COMPILED_HOOK_FILE" ]; then
  exec ...   # compiled
fi
exec node "$TSX" ... "$HOOK_FILE"   # tsx fallback
```

production-only로 가지 않은 이유:

1. **개발 환경**에서 `npm run build --workspace @monitor/runtime`을 안 돌렸을 수 있음
2. **plugin 배포 packaging 버그**로 `dist/`가 누락될 수 있음
3. **monorepo runtime root**와 Claude Code plugin root가 다르게 묶일 수 있음 (CLAUDE_PLUGIN_ROOT vs 개발 working dir)
4. **새 hook 추가**해서 `.ts`만 있고 아직 빌드 안 했을 때 그냥 동작하는 게 좋음

성능 개선은 dist가 있을 때 자동으로 얻고, 없으면 기존 동작으로 안전하게 돌아간다.

회귀 테스트도 이 정책을 검증한다 (`packages/runtime/test/claude-run-hook.test.ts`):
- compiled JS와 TS source가 둘 다 있으면 compiled JS 우선
- nested path (`PostToolUse/Bash`)도 compiled artifact 우선
- 둘 다 없으면 graceful exit

---

## 8. 측정 결과의 해석

### 8.1 왜 server benchmark가 아니라 hook wall-clock인가

Phase 2는 server ingest 알고리즘을 바꾸지 않는다. DB write, NestJS endpoint, OTel, HTTP 처리량 모두 동일.

직접 효과는 **client-side(hook) startup 비용**이므로 측정 대상은:
- hook process wall-clock p50 / p95 / p99
- failures (오류로 빨리 끝나서 latency가 낮아진 게 아닌지)

### 8.2 우리 측정값 (median of 3 runs)

| 변종 | SessionStart p99 | StatusLine p99 | PreToolUse p99 | UserPromptSubmit p99 | PostToolUse/Bash p99 | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| AS-IS (`node + tsx`) | 336.41 | 243.79 | 204.58 | 197.40 | 272.52 | **250.94** |
| `node + 컴파일 JS` | 101.88 | 93.92 | 50.94 | 49.93 | 93.50 | **78.03** |
| `bun + .ts` | 84.27 | 45.04 | 33.27 | 33.14 | 48.31 | **48.81** |
| `bun + 컴파일 JS` | 58.42 | 51.98 | 30.65 | 26.22 | 51.37 | **43.73** |

관찰:
- **PreToolUse / UserPromptSubmit**이 가장 큰 단축 (200 → 50 ms 수준). 이 hook들은 payload가 작고 hook logic 자체가 가벼워서 startup 비중이 가장 컸음.
- **SessionStart**는 단축 비율이 상대적으로 작음 (336 → 102 ms = 70 %, 다른 hook은 75–90 %). DB 초기 ensure 호출이 한 번 들어 있어 hook logic 비중이 더 큼.

### 8.3 남은 ~40 ms는 무엇인가

`bun + compiled JS` 기준 p99 약 40 ms는 다음의 합:

| 단계 | 추정 비용 |
|---|---|
| Claude Code → bash spawn | ~5 ms |
| bash startup + path resolve | ~3 ms |
| bun process bootstrap | ~10–15 ms |
| JS bundle parse + evaluate | ~5–10 ms |
| stdin read + JSON parse | ~3 ms |
| business logic + UDS write (or HTTP fetch) | 5–10 ms |
| process exit | ~1 ms |

**Phase 2가 제거한 것**: "Node를 켠 뒤 TypeScript 실행 환경을 즉석으로 구성하는 비용" (약 100–200 ms).

**Phase 2가 못 없앤 것**: process spawn + runtime bootstrap (약 20–30 ms). 이 floor는 Phase 3 daemon으로 가야 더 줄어든다 — `bun spawn 비용`을 IPC write 비용 (UDS 쓰기 ~1–3 ms)으로 대체.

---

## 9. 한 줄 요약

> **Claude Code hook은 "매 이벤트마다 새로 뜨는 short-lived 프로세스"이기 때문에, TypeScript runtime transpilation을 빌드 타임으로 옮긴 것만으로 hook latency가 70–80 % 줄어든다. 같은 코드를 단지 다른 시점에 변환했을 뿐이지만, "변환을 매번 하느냐 / 한 번만 하느냐"의 차이가 사용자 critical path에 들어 있는 hook에서는 결정적인 성능 차이를 만든다.**
