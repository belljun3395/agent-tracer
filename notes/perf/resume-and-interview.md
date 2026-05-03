# 이력서 / 면접 자료 — Agent Tracer 성능 개선 (Phase 2+3)

> Phase 2+3 작업을 이력서·면접에 쓸 때 활용할 자료. 프로젝트 소개, 기술 스택 선택 이유, 측정 기반 개선 수치, 예상 면접 질문과 답변까지 한 문서에 정리.

---

## 1. 프로젝트 한 줄 정의 (엘리베이터 피치)

> **Agent Tracer는 Claude Code / Codex 같은 에이전트가 실제 어떤 도구를 어떤 순서로 호출하고, 어디서 막히고, 어떤 결과를 만드는지를 hook 단위로 캡처해 시각화하는 self-hosted observability 도구입니다.**

조금 더 풀어 쓰면:

- **무엇**: 에이전트의 tool 호출, 세션, 워크플로우, 실패를 sub-second로 ingest하고 web UI로 보여주는 monorepo 앱.
- **왜**: 에이전트가 무엇을 하는지 사람이 직접 들여다볼 수 있는 단일 진실 공급원이 없으면 디버깅과 성능 개선이 추측이 됨.
- **어떻게**: Claude Code의 hook(SessionStart / PreToolUse / PostToolUse / StatusLine 등) 56개 entry를 plugin으로 주입 → 로컬 daemon → NestJS ingest server → SQLite + OTel → React UI.

---

## 2. 기술 스택과 선택 이유

### 2.1 단일 언어로 풀스택 — TypeScript

```
packages/server/   NestJS 11 + TypeORM + better-sqlite3
packages/runtime/  Hooks runtime (Claude Code plugin)
packages/web/      React 19 + TanStack Query + Zustand
```

**왜 TypeScript 단일화**:
1. **에이전트와 도구 친화적**: Claude / Codex 등 LLM 에이전트가 가장 잘 다루는 언어 중 하나. type signature가 docstring 역할을 해서 에이전트가 코드를 읽을 때 의도 추론이 쉬움.
2. **타입 시스템 = 도메인 명세**: hook payload, ingest event, transport result 같은 핵심 타입이 모든 패키지에서 공유 (`~shared/events/kinds.type.ts`, `~shared/transport/transport.type.ts`). 서버 코드를 고치면 hook 코드와 web UI가 동시에 깨짐 → 안전한 refactoring.
3. **풀스택 cognitive load 감소**: server / hook / web을 한 사람이 들여다보며 일관된 mental model로 작업 가능. context switching 비용 0.
4. **공통 도구 체인**: `eslint`, `vitest`, `tsc`, `knip`을 monorepo 전체에 동일 설정으로 적용. CI 파이프라인 단순화.

### 2.2 NestJS + TypeORM (server) — 선택 이유

**NestJS**:
- 서버 시작 시간이 짧음 (Express 기반, 수백 ms 안에 ready). Bench 컨테이너에서도 1초 안에 ready 상태가 됨.
- **Decorator + DI**가 OTel auto-instrumentation, transactional, validation, guard 같은 cross-cutting concern과 자연스럽게 결합.
- 모듈 단위 분리가 명확해 ingest / query / observability 책임이 자동으로 분리됨.

**TypeORM**:
- LLM 에이전트가 코드를 읽고 변경할 때 가장 보편적인 ORM. 에이전트의 trained behavior가 가장 안정적.
- **Entity decorator로 스키마와 모델이 같은 곳**. SQL 마이그레이션과 모델 정합성을 한 파일에서 관리.
- `typeorm-transactional`로 distributed transaction 모델을 NestJS DI와 통합 → ingest 경로의 atomicity 보장.

**better-sqlite3**:
- Self-hosted observability 도구라 별도 DB 인프라 강제하지 않음.
- 동기 API라 latency 분석이 쉽고 OTel span이 깔끔하게 떨어짐.
- 단일 사용자 / 단일 머신 워크로드에 충분.

### 2.3 OpenTelemetry — 선택 이유

- **자기 자신을 측정하는 도구가 자기 자신의 성능 데이터를 OTel로 노출**한다는 일관성. Agent Tracer가 만드는 데이터는 OTel-compatible.
- HTTP 자동 계측 (`@opentelemetry/auto-instrumentations-node`) → server 변경 없이 모든 endpoint 메트릭 확보.
- Prometheus exporter로 `/metrics` 노출 → Grafana 대시보드 / k6 부하 테스트에서 실시간 회귀 감지.

### 2.4 esbuild — Hook 빌드 도구 선택 이유

후보를 비교한 결과:

| 후보 | TS transform | Bundle | Path alias | Node target | typecheck | 빌드 속도 |
|---|---|---|---|---|---|---|
| `tsc` | ✓ | ✗ | ✓ (별도 처리) | ✓ | **✓** | 느림 |
| `swc` | ✓ | △ | ✓ | ✓ | ✗ | 빠름 |
| `rollup` | △ (plugin) | ✓ | ✓ | ✓ | ✗ | 느림 |
| `tsup` | ✓ (esbuild wrapper) | ✓ | ✓ | ✓ | ✗ | 빠름 |
| **esbuild** | ✓ | **✓** | ✓ | ✓ | ✗ | **매우 빠름** |

요구 조건:
1. **bundling 필수** — short-lived hook process의 import graph 비용 제거
2. **alias 직관적** — `~shared`, `~claude-code` 매핑
3. **CI 빠른 빌드** — 56 hook entry × 매 PR

→ esbuild 채택. typecheck는 별도 pipeline (`tsc -p ... --noEmit` + `vitest` + `eslint`).

### 2.5 Bun — 선택적 fast runtime

- **Hook 같은 short-lived process에 최적화된 startup**.
- 같은 컴파일 JS를 실행해도 Node 78 ms → Bun 44 ms (약 −44 %).
- 그러나 사용자 환경 의존성 → **Bun이 있으면 Bun, 없으면 Node로 fallback**. 한 산출물(컴파일 JS)이 두 런타임 모두에서 동작.

### 2.6 Frontend (web) — React 19 + TanStack Query + Zustand

- React 19로 fine-grained transition / `use()` API 활용 가능
- TanStack Query: ingest 서버에서 polling하는 dashboard에 stale-while-revalidate가 자연스럽게 fit
- Zustand: UI 로컬 상태 (filter, selection, panel toggle). Redux보다 가볍고 React 19와 호환성 안정적.
- 모두 TypeScript 기반이라 server type을 그대로 import해서 사용

### 2.7 Vite + VitePress

- **Vite**: web 패키지 dev / build. 시작 200 ms 이내, HMR 즉시 반영. 풀스택 dev 사이클이 끊기지 않음.
- VitePress: 공개 가이드 문서 (`docs/guide/*.md`)를 정적 사이트로 빌드. 성능 분석 노트는 `notes/perf/`에 둬서 VitePress가 안 건드리게 분리.

---

## 3. 측정 기반 개선 수치 — 한눈에 보는 표

### 3.1 핵심 결과 (median of 3 runs, 동일 Docker 1 vCPU/256 MiB 환경)

| 지표 | AS-IS | 최종 (Phase 2+3) | Δ |
|---|---:|---:|---:|
| **Avg hook p99 (ms)** | **250.94** | **41.93** | **−83.3 %** |
| SessionStart p99 | 336.41 | 42.49 | −87.4 % |
| StatusLine p99 | 243.79 | 43.04 | −82.3 % |
| PreToolUse p99 | 204.58 | 45.13 | −77.9 % |
| UserPromptSubmit p99 | 197.40 | 39.16 | −80.2 % |
| PostToolUse/Bash p99 | 272.52 | 39.85 | −85.4 % |
| CPU avg (%) | 97.13 | 80.69 | −16.4 pp |
| Memory avg (MiB) | 65.30 | 43.80 | −32.9 % |
| V8 heap (MiB) | 51.86 | 44.17 | −14.8 % |
| **hook latency variance** | ~140 ms | **~6 ms** | **5배 평탄화** |

### 3.2 단계별 기여도

| Phase | 변경 | Avg p99 | 누적 Δ |
|---|---|---:|---:|
| AS-IS | node + tsx + HTTP | 250.94 | — |
| Phase 2 (node JS) | esbuild precompile + node | 78.03 | −69 % |
| Phase 2 (bun TS) | bun runtime, TS native | 48.81 | −81 % |
| Phase 2 (bun JS) | bun + precompile | 43.73 | −83 % |
| **Phase 2+3** | bun + precompile + UDS daemon | **41.93** | **−83.3 %** |

### 3.3 측정 신뢰도

- **3회 실행 후 median run의 artifact 사용** (외란 영향 분리)
- 동일 Docker resource limit (`--cpus=1.0 --memory=256m`)
- Prometheus + OTel 서버 metric 동시 수집 (`up{job="agent-tracer-server"}==1` 게이트)
- 모든 측정에 hook failure 0 / server 5xx 0
- 측정 artifact 모두 보존 (`observability/results/docker-phase-bench/`)

---

## 4. 이력서 표현 — 길이별

### 4.1 한 줄 (Bullet 1개)
> Self-hosted Claude Code observability 도구 Agent Tracer의 hook 실행 경로를 `node + tsx + HTTP`에서 `bun + esbuild precompiled JS + UDS daemon` 구조로 재설계해 hook wall-clock p99 250.94 ms → 41.93 ms (−83.3 %), 메모리 사용 −33 % 달성.

### 4.2 두 줄
> Claude Code hook의 critical-path latency를 줄이기 위해 (1) tsx 런타임 트랜스파일을 esbuild bundle precompile로 빌드 타임으로 이전, (2) HTTP transport를 long-lived UDS daemon으로 교체하는 두 단계 개선을 측정 기반 (3-run median, Docker resource-pinned)으로 검증. **hook p99 −83.3 %, 메모리 −33 %, p99 variance 5배 평탄화**.

### 4.3 네 줄 (STAR)
> **Situation**: Claude Code hook은 매 이벤트마다 새 프로세스로 실행되는 short-lived 구조라, `node + tsx`의 런타임 TypeScript transpile 비용이 매번 사용자 critical path에 100 ms+ 추가되고 있었음.
> **Task**: 사용자가 체감하는 hook latency를 운영 환경에 추가 의존성을 강제하지 않으면서 줄이는 방법을 찾기.
> **Action**: 56개 hook entry를 esbuild로 ESM bundle 사전 컴파일 + Bun runtime 자동 감지 fallback + long-lived daemon이 UDS 위에서 fire-and-forget으로 메시지 전달하는 구조 설계. 결정적 UUID v5 트릭으로 응답이 필요한 `/sessions/ensure`도 fire-and-forget화. 모든 단계에서 Docker resource-pinned harness로 3-run median 측정.
> **Result**: hook p99 250.94 → 41.93 ms (−83.3 %), 메모리 65 → 44 MiB (−33 %), p99 variance 140 → 6 ms (5배 평탄화). hook failure 0, server 5xx 0.

### 4.4 6–7줄 (시스템 설계 강조 버전)
> Claude Code 56개 hook entry의 cold-start 비용 분석을 위해 Docker resource-pinned 벤치마크 harness (cpus / mem 고정, Prometheus auto-discovery, 3-run median selector)를 직접 구축.
> tsx 런타임 트랜스파일이 hook 호출당 100 ms+를 차지함을 확인하고, esbuild bundle (`bundle: true`, `packages: external`, ESM, node20 target)로 빌드 타임 이전.
> 같은 컴파일 JS 산출물을 Node와 Bun에서 모두 측정해 V8 vs JavaScriptCore의 startup 특성과 표준 라이브러리 fast path 차이를 정량화. 하나의 산출물로 두 런타임을 모두 지원하면서 Bun이 있으면 자동으로 빠른 경로를 타는 구조.
> 마지막으로 hook → server 사이의 transport를 HTTP에서 long-lived UDS daemon + newline-delimited JSON으로 교체. 결정적 UUID v5로 응답 필요 호출까지 fire-and-forget화하고, daemon은 `~/.agent-tracer/daemon.sock` (chmod 0600)에 listen하며 idle 5분 후 자동 종료.
> hook p99 250.94 → 41.93 ms (−83.3 %), p99 variance 140 → 6 ms로 평탄화. 모든 phase 분기와 측정 artifact를 git history에 보존 (perf/base · perf/phase2-* · perf/phase3-* · perf/phase2-3-* · perf/summary).

### 4.5 키워드만 — JD 매칭용
- TypeScript / Node.js / Bun
- NestJS / Express 5 / TypeORM / better-sqlite3
- React 19 / TanStack Query / Zustand / Vite
- esbuild bundle (precompile, alias, ESM, node target)
- OpenTelemetry / Prometheus / Grafana / k6
- Unix Domain Socket / IPC / fire-and-forget protocol
- 결정적 UUID v5 (name-based)
- Docker resource-pinned benchmark, 3-run median
- Critical path latency, p99 variance, cold start

---

## 5. 예상 면접 질문 + 답변

### 5.1 프로젝트 / 의사결정

**Q1. 이 프로젝트는 무엇이고 왜 만들었나요?**

Agent Tracer는 Claude Code나 Codex 같은 에이전트가 실제로 어떤 hook을 어떤 순서로 호출하고 어디서 실패하는지를 캡처해서 시각화하는 self-hosted observability 도구입니다. 에이전트를 일상적으로 쓰면서 "지금 무엇을 하고 있는지", "왜 멈췄는지"를 추측이 아니라 실제 데이터로 확인할 단일 도구가 없어서 직접 만들었습니다.

**Q2. 왜 단일 언어(TypeScript)로 풀스택을 갔나요?**

세 가지 이유입니다. 첫째, hook payload나 ingest event 같은 도메인 타입을 server·hook·web에서 모두 공유해서 서버를 고치면 hook과 web이 동시에 컴파일 에러로 잡히게 했습니다. refactoring이 안전합니다. 둘째, LLM 에이전트가 가장 안정적으로 다루는 언어 중 하나라 코드 수정 자동화 시 신뢰도가 높습니다. 셋째, 풀스택 한 사람이 한 mental model로 작업 가능합니다.

**Q3. NestJS, TypeORM을 고른 이유는요?**

NestJS는 서버 시작 시간이 빠르고 (수백 ms), Decorator + DI가 OTel auto-instrumentation과 자연스럽게 결합합니다. 모듈 분리가 명확해 ingest / query / observability 책임이 자동으로 분리됩니다. TypeORM은 LLM 에이전트가 코드 변경할 때 가장 안정적인 ORM이고, Entity decorator로 스키마와 모델이 한 곳에 있어 마이그레이션 정합성 관리가 단순합니다.

**Q4. Bun을 default로 안 쓰고 fallback 구조로 둔 이유는요?**

성능만 보면 Bun이 명확한 승자지만 (`bun + JS` 43 ms vs `node + JS` 78 ms), Bun은 사용자 환경 의존성입니다. Plugin으로 배포되는 hook은 사용자가 Bun 미설치일 가능성을 받아들여야 합니다. 컴파일 JS는 Node와 Bun이 둘 다 실행 가능하므로 한 산출물로 양쪽 모두 지원하고, `RUNTIME=bun` 환경변수로 Bun이 있을 때 자동으로 빠른 경로가 타게 했습니다.

### 5.2 기술 — Phase 2 (tsx → 컴파일 JS)

**Q5. tsx가 정확히 무엇이고 왜 느렸나요?**

tsx는 TypeScript / TSX 파일을 Node에서 바로 실행할 수 있게 해주는 런타임 트랜스파일러입니다. 개발 환경에선 빌드 없이 .ts를 바로 실행하는 게 편하지만, hook은 매 이벤트마다 새 프로세스로 뜨는 short-lived 구조입니다. tsx CLI 로드, tsconfig 파싱, ESM loader 설정, TypeScript transform, path alias 해석 비용이 hook 호출 한 번마다 처음부터 반복됐습니다. business logic보다 실행 환경 구성 비용이 훨씬 컸습니다.

**Q6. esbuild를 고른 이유는요? tsc와 차이는?**

tsc는 TypeScript 공식 compiler라 typecheck엔 강하지만 기본적으로 bundling을 안 합니다. 이번 문제는 단순 transpile뿐 아니라 short-lived process에서 module resolution / import graph 비용도 줄여야 했습니다. esbuild는 TS transform과 bundling, Node target, alias 설정을 단순하게 처리하면서 빌드도 매우 빠릅니다. typecheck는 별도 `tsc --noEmit` + vitest + eslint 파이프라인으로 보완했습니다.

**Q7. `bundle: true`가 왜 중요한가요?**

hook은 매번 새 프로세스라 여러 내부 JS 파일을 하나하나 resolve / load / parse 하는 비용도 반복됩니다. bundle:true는 hook entry와 internal dependency를 하나의 산출물로 묶어 런타임 module resolution과 디스크 I/O를 줄입니다. 서버처럼 한 번 띄우는 프로세스에선 amortize되지만 hook에선 매번 반복되기 때문에 핵심 최적화입니다.

**Q8. `packages: "external"`은 왜 그렇게 두었나요?**

외부 npm 패키지까지 모두 bundle하면 런타임 resolution은 더 줄지만, bundle size가 커지고 native module이나 conditional exports 호환성 문제가 생깁니다. 이번 병목은 internal TypeScript runtime path와 alias / import graph였으므로 internal 코드 bundling만으로 충분했습니다. 향후 외부 의존성이 hot path에 추가되면 selective bundling을 검토할 수 있습니다.

### 5.3 기술 — Node vs Bun

**Q9. Node와 Bun의 기술적 차이를 성능 관점에서 설명하세요.**

엔진부터 다릅니다. Node는 V8(Chrome 계열), Bun은 JavaScriptCore(Safari 계열)입니다. V8은 long-running server에서 JIT warmup 후 throughput이 강력하고, JSC는 short-lived 환경에서 startup이 가벼운 쪽으로 진화했습니다. Hook은 명백히 후자입니다. 그리고 런타임 구현 언어도 다릅니다 — Node는 C++, Bun은 Zig. Bun은 표준 라이브러리 fast path를 native로 깔아놨고, allocator를 단계별로 다른 걸 쓰는 등 short-lived 작업에 유리합니다. 측정해보면 같은 컴파일 JS를 실행해도 hook p99이 78 → 44 ms로 약 44 % 빨랐습니다.

**Q10. 그러면 Node 서버도 Bun으로 옮길 수 있나요?**

이론적으로 가능하지만 권장하지 않습니다. NestJS의 OTel auto-instrumentation은 `require-in-the-middle` / `import-in-the-middle` hooking에 의존하는데 Bun과 100 % 호환이라고 단정하기 어렵습니다. 그리고 server는 long-lived라 Bun의 startup 우위가 amortize됩니다. **Hook process만 Bun, server는 Node** 비대칭 구조가 안전한 선택이었습니다.

### 5.4 기술 — UDS daemon

**Q11. 같은 머신 안 통신인데 왜 HTTP가 아니라 UDS인가요?**

같은 머신의 `127.0.0.1` HTTP도 TCP 스택을 통과하고 HTTP framing을 매번 거칩니다. UDS는 IP layer를 안 거치고 filesystem 권한 모델 위에서 직접 byte stream을 주고받습니다. connect 비용이 0.1 ms → 0.02 ms 수준이고, 무엇보다 응답이 필요 없는 fire-and-forget 메시지에 HTTP request/response 모델이 과합니다. newline-delimited JSON으로 충분합니다.

**Q12. 결정적 UUID 트릭은 정확히 무엇이고 왜 필요했나요?**

`/sessions/ensure`는 hook이 server에 "내 세션을 등록해줘, ID 받아갈게"하는 호출입니다. 응답 ID를 받아야 다음 이벤트에 그 ID를 붙일 수 있어서 fire-and-forget이 안 됩니다. 그래서 hook이 (runtimeSource, runtimeSessionId)에서 UUID v5 (SHA-1 namespace UUID)로 ID를 결정적으로 만들고, "이 ID로 server-side 등록 해줘"를 daemon에 enqueue하고 즉시 종료합니다. Server는 idempotent (`taskCreated: false` 응답 처리)라 같은 ID로 ensure가 여러 번 와도 OK. 이렇게 응답이 필요한 호출까지 fire-and-forget으로 만들었습니다.

**Q13. daemon이 죽으면 어떻게 되나요?**

세 단계 fallback이 있습니다. 첫째, hook이 UDS write 실패 시 다음 hook이 자동으로 daemon을 spawn합니다 (`maybeStartDaemon`이 detached child로 띄우고 hook은 즉시 exit). 둘째, daemon spawn조차 실패하면 hook은 timeout 후 throw, 그 위 transport가 HTTP fallback으로 직접 server에 보냅니다. 셋째, `MONITOR_TRANSPORT=http` 환경변수로 daemon 경로 자체를 끌 수 있습니다 (escape hatch).

**Q14. Phase 3 단독은 −12.5 %로 작은데 가치가 있나요?**

Phase 3 단독 효과가 작은 건 hook의 bottleneck이 여전히 `node + tsx` cold start이기 때문입니다 (200 ms+). Phase 2와 결합하면 cold start floor가 30–40 ms로 낮아진 뒤에야 daemon의 transport 절약 (∼2 ms)과 variance 평탄화가 의미 있는 비중이 됩니다. Phase 2+3 결합본은 hook p99 variance를 32 ms → 6 ms로 5배 평탄화했습니다 — 사용자 체감 일관성이 큰 폭 개선됐습니다.

### 5.5 측정 / 방법론

**Q15. 측정이 공정하다는 걸 어떻게 보장했나요?**

다섯 가지로 보장했습니다. 첫째, 모든 phase를 동일한 Docker 자원 (`--cpus=1.0 --memory=256m`) 안에서 실행. 둘째, 각 phase 측정을 **3회 실행 후 avg phase p99의 median run을 채택** — 1회 측정의 outlier 영향 분리. 셋째, hook 외부 wall-clock으로 측정 (hook 내부 timer가 아님). 넷째, 모든 측정에 `failures: 0` / `server 5xx: 0` 검증 (빨리 실패해서 latency가 낮아진 게 아니라는 증거). 다섯째, Prometheus의 `up{job="agent-tracer-server"} == 1` 게이트를 측정 시작 전 통과하지 못하면 측정 자체가 실패하도록 harness에 포함.

**Q16. 왜 p99을 봤나요? 평균만 보면 안 되나요?**

사용자 체감 latency는 tail latency에 민감합니다. 평균 50 ms이라도 1 %의 호출이 500 ms로 튀면 사용자는 "이 도구는 가끔 멈춘다"고 느낍니다. 그래서 p50 / p95 / p99 / max를 모두 기록하고, 이력서엔 p99 개선을 강조했습니다. variance까지 같이 보면 일관성도 측정 가능합니다.

**Q17. 왜 `notes/perf/`에 두고 `docs/`에 안 뒀나요?**

`docs/`는 VitePress 정적 사이트 빌드 대상입니다. 측정 노트는 외부 공개 가이드가 아니라 내부 분석 자료라 VitePress가 dead-link 검사 등으로 처리하지 않게 분리했습니다. 또한 측정 시점의 SHA / 컨테이너 timestamp 같은 reproducibility 메타데이터를 자유롭게 적기 위함.

### 5.6 자주 빠지는 함정

**Q18. 이 개선이 server 처리량도 올리나요?**

직접적으론 아닙니다. Phase 2+3는 hook client-side latency를 줄이는 변경입니다. server ingest throughput, DB write 속도, HTTP keep-alive batching은 거의 그대로입니다. 다만 daemon이 server에 보내는 호출 패턴이 더 일관돼서 server queue spike는 줄었습니다.

**Q19. CPU avg가 97% → 81%로 줄었는데 그게 좋은 건가요? 자원이 남는 거 아닌가요?**

좋은 신호입니다. AS-IS 97 %는 hook 컨테이너가 1 vCPU 거의 saturating한 상태였고, 이는 hook이 자기 자신의 cold-start로 CPU를 소모하고 있었다는 뜻입니다. 81 %는 같은 작업을 더 적은 CPU로 끝낸다는 거고, 남는 자원은 다른 hook이나 다른 워크로드를 동시에 받을 수 있습니다. 즉 throughput headroom이 늘어남.

**Q20. Phase 3의 daemon이 메모리 22 MiB 잡는 건 비용 아닌가요?**

메모리 비용은 맞지만 hook 호출이 분당 수십 회 이상이면 충분히 정당화됩니다. 그리고 5분 idle 시 자동 종료되도록 설계해서 안 쓸 때는 자원 소비 0. AS-IS의 "매 hook이 65 MiB씩 잡았다 풀었다" 패턴 (메모리 churn) 대비 daemon 22 MiB 상주가 GC 부담 측면에서도 더 안정적.

### 5.7 한 단계 더 깊은 질문

**Q21. UDS write 실패가 나면 hook은 어떻게 행동하나요? 데이터 손실은?**

UDS write 실패 → daemon spawn 시도 → 1초 polling 후에도 실패 → throw → 위 transport layer가 catch하고 HTTP fallback. 만약 server도 unreachable이면 hook은 fail해서 Claude Code log에 에러로 남고, 해당 이벤트는 손실. 다만 **observability 데이터의 일부 손실은 critical 하지 않다**는 trade-off를 받아들임. 필요하면 daemon에 disk-backed queue를 추가해서 server 일시 다운 시에도 손실 없게 확장 가능.

**Q22. daemon이 메시지 받았지만 server에 보내기 전에 daemon이 죽으면?**

현재 구조에선 큐가 메모리이므로 손실. 단, daemon은 SIGTERM / SIGINT 시 `gracefulShutdown`으로 큐를 drain하고 exit. 일반 종료 경로에선 손실 없음. SIGKILL이나 OOM kill은 손실 가능 — 이게 우려된다면 disk queue 도입.

**Q23. p99 variance가 5배 평탄화됐다고 하는데 실제로 어떤 상황에서 차이가 나나요?**

여러 hook이 동시에 발생하는 burst 상황. 예를 들어 PreToolUse / PostToolUse가 짧은 시간에 연달아 호출될 때 HTTP transport에선 각 hook이 독립 connection을 만들어 server에 동시 도착하고 server queue에서 일부가 더 오래 기다림. UDS daemon은 단일 큐에서 순서대로 server keep-alive로 보내서 server queue 폭주가 안 일어남. 결과: 같은 burst에서 hook 간 latency 격차가 30 ms+에서 6 ms 이내로.

**Q24. 이 작업의 다음 단계로 무엇을 할 건가요?**

세 가지 후보. (1) **batch ingest**: daemon이 메시지를 1초 또는 100건 단위로 묶어 server에 한 번에 보내기. server-side throughput에 직접 도움. (2) **daemon health monitoring**: daemon이 자기 자신의 큐 깊이 / queue latency를 OTel로 노출하고 alert 가능하게. (3) **disk-backed queue**: daemon 죽음 / server 일시 다운에도 데이터 손실 없게.

---

## 6. 한 문장 결론 (면접에서 압축해 말할 때)

> "Claude Code hook은 매 이벤트마다 새 프로세스로 뜨는 short-lived 구조라 사용자 critical path에 100 ms+ 의 cold start가 매번 붙어 있었습니다. esbuild로 hook을 사전 컴파일해서 런타임 TypeScript transpile을 빌드 타임으로 옮기고, Bun runtime을 자동 감지해서 startup이 가벼운 JSC를 쓰고, hook → server 통신을 long-lived UDS daemon + 결정적 UUID로 fire-and-forget화한 결과, hook p99을 250 ms → 42 ms로 −83.3 %, p99 variance를 5배 평탄화시켰습니다. 모든 단계는 Docker resource-pinned 3-run median으로 측정했고, hook failure / server 5xx 0을 유지하면서 달성한 수치입니다."
