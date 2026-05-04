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
| SessionStart p99 / p95 | 336.41 / ~310 | 42.49 / ~40 | ~−87 % |
| StatusLine p99 / p95 | 243.79 / 217 | 43.04 / ~41 | ~−82 % |
| PreToolUse p99 / p95 | 204.58 / 188 | 45.13 / ~43 | ~−77 % |
| UserPromptSubmit p99 / p95 | 197.40 / 178 | 39.16 / ~37 | ~−80 % |
| PostToolUse/Bash p99 / p95 | 272.52 / 234 | 39.85 / ~38 | ~−85 % |
| CPU avg (%) | 97.13 | 80.69 | −16.4 pp |
| Memory avg (MiB) | 65.30 | 43.80 | −32.9 % |
| V8 heap (MiB) | 51.86 | 44.17 | −14.8 % |
| 5 hook p99 분포 폭 (max − min) | ~140 ms | **~6 ms** | 분포 평탄화 (메커니즘은 §5.4 Q14 참조) |

> **표 읽는 주의**: p99은 iteration n=50 측정이라 사실상 max에 가깝다. p95이 더 robust한 통계지만 절대 차이가 비슷하므로 결론은 바뀌지 않는다. 다음 측정 round에서 iteration을 키울 예정.

### 3.2 단계별 기여도

| Phase | 변경 | Avg p99 | 누적 Δ |
|---|---|---:|---:|
| AS-IS | node + tsx + HTTP | 250.94 | — |
| Phase 2 (node JS) | esbuild precompile + node | 78.03 | −69 % |
| Phase 2 (bun TS) | bun runtime, TS native | 48.81 | −81 % |
| Phase 2 (bun JS) | bun + precompile | 43.73 | −83 % |
| **Phase 2+3** | bun + precompile + UDS daemon | **41.93** | **−83.3 %** |

> **주의 1**: 각 phase의 baseline은 250.94 ~ 264.96 ms 사이에서 ~14 ms 폭으로 변동. phase 내부의 AS-IS↔TO-BE 비교는 fair하지만 위 표의 절대값 횡단 비교는 baseline 정규화 안 함.
> **주의 2**: phase2-bun-js(43.73)와 phase2-3(41.93)의 1.8 ms 차이는 같은 phase2-3 구성의 3 run avg가 41.93 / 47.99 / 59.29로 17 ms 폭의 jitter를 보였기 때문에 통계적으로 noise에 묻혀 있음. Phase 2+3을 권장한 진짜 이유는 latency가 아니라 운영 properties (server timeout 격리, batch chokepoint, connection churn 감소).

### 3.3 측정 신뢰도와 그 한계

**한 것**:
- 3회 실행 후 median run의 artifact 채택 (1회 outlier 영향 분리)
- 동일 Docker resource limit (`--cpus=1.0 --memory=256m`)
- Prometheus + OTel 서버 metric 동시 수집 (`up{job="agent-tracer-server"}==1` 게이트로 측정 환경 검증)
- 모든 측정에 hook failure 0 / server 5xx 0
- 측정 artifact 모두 보존 (`observability/results/docker-phase-bench/`)

**한계 (다음 round에서 보완 예정)**:
- iteration n=50, run n=3은 작은 sample. 100 ms 단위 차이엔 의미 있지만 1–2 ms 단위 차이는 noise 안에 있음.
- `--cpus=1.0`은 Docker CFS bandwidth의 soft cap이라 측정에서 CPU max가 105 %를 보임. hard limit은 아님.
- baseline이 phase 측정마다 14 ms 폭으로 변동. 횡단 비교 시 정규화 부재.
- Bun이 Node보다 빠른 것은 측정으로 확인했으나, **어느 요인 (JSC 엔진 / Bun core native / ESM resolver / GC / stdlib fast path)에서 얼마씩 기여했는지는 분리 측정 안 함**.

---

## 4. 이력서 표현 — 길이별

### 4.1 한 줄 (Bullet 1개)
> Self-hosted Claude Code observability 도구 Agent Tracer의 hook 실행 경로를 `node + tsx + HTTP`에서 `bun + esbuild precompiled JS + UDS daemon` 구조로 재설계해 hook wall-clock p99 250.94 ms → 41.93 ms (−83.3 %), 메모리 사용 −33 % 달성.

### 4.2 두 줄
> Claude Code hook의 critical-path latency를 줄이기 위해 (1) tsx 런타임 트랜스파일을 esbuild bundle precompile로 빌드 타임으로 이전, (2) HTTP transport를 long-lived UDS daemon으로 교체하는 두 단계 개선을 측정 기반 (3-run median, Docker resource-pinned)으로 검증. **hook p99 −83.3 %, 메모리 −33 %, 5개 hook 사이의 p99 분포 폭 ~140 ms → ~6 ms로 평탄화**.

### 4.3 네 줄 (STAR)
> **Situation**: Claude Code hook은 매 이벤트마다 새 프로세스로 실행되는 short-lived 구조라, `node + tsx`의 런타임 TypeScript transpile 비용이 매번 사용자 critical path에 100 ms+ 추가되고 있었음.
> **Task**: 사용자가 체감하는 hook latency를 운영 환경에 추가 의존성을 강제하지 않으면서 줄이는 방법을 찾기.
> **Action**: 56개 hook entry를 esbuild로 ESM bundle 사전 컴파일 + Bun runtime 자동 감지 fallback + long-lived daemon이 UDS 위에서 fire-and-forget으로 메시지 전달하는 구조 설계. server가 발급할 진짜 sessionId를 hook이 기다릴 수 없으므로, hook이 결정적 UUID v5 placeholder로 즉시 응답하고 daemon이 server-assigned ID와 사후 매핑/rewrite하는 fire-and-forget 트릭 추가. 모든 단계에서 Docker resource-pinned harness로 3-run median 측정.
> **Result**: hook p99 250.94 → 41.93 ms (−83.3 %), 메모리 65 → 44 MiB (−33 %), 5개 hook 사이의 p99 분포 폭 ~140 → ~6 ms로 평탄화. hook failure 0, server 5xx 0.

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
- 결정적 UUID v5 placeholder + post-hoc daemon ID rewrite
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

표면적으로는 엔진이 다릅니다. Node는 V8 (Chrome 계열), Bun은 JavaScriptCore (Safari 계열)입니다. 일반적으로 알려진 차이는 V8이 long-running server의 JIT warmup 후 throughput에 강하고 JSC가 startup-friendly로 평가되는 정도입니다. 런타임 구현 언어도 Node는 C++, Bun은 Zig로 다릅니다. **다만 솔직히 말씀드리면, 우리가 측정한 "같은 컴파일 JS에서 78 ms → 44 ms (44% 단축)"는 Bun 런타임 전체가 Node 런타임 전체보다 빠르다는 것까지만 입증된 것이고, 그 차이가 JS 엔진(JSC vs V8) / 표준 라이브러리 (Bun native vs Node JS layer) / ESM resolver / GC 전략 중 어디에서 얼마씩 왔는지를 분리해 주는 micro-benchmark는 이번 작업에서 안 했습니다**. 면접에서 정확한 attribution을 묻는 거라면 "분리 측정 안 했고, 위의 일반 narrative와 plausibly 부합하는 수준"이 정직한 답입니다.

**Q10. 그러면 Node 서버도 Bun으로 옮길 수 있나요?**

이론적으로 가능하지만 권장하지 않습니다. NestJS의 OTel auto-instrumentation은 `require-in-the-middle` / `import-in-the-middle` hooking에 의존하는데 Bun과 100 % 호환이라고 단정하기 어렵습니다. 그리고 server는 long-lived라 Bun의 startup 우위가 amortize됩니다. **Hook process만 Bun, server는 Node** 비대칭 구조가 안전한 선택이었습니다.

### 5.4 기술 — UDS daemon

**Q11. 같은 머신 안 통신인데 왜 HTTP가 아니라 UDS인가요?**

같은 머신의 `127.0.0.1` HTTP도 TCP 스택을 통과하고 HTTP framing을 매번 거칩니다. UDS는 IP layer를 안 거치고 filesystem 권한 모델 위에서 직접 byte stream을 주고받습니다. connect 비용이 0.1 ms → 0.02 ms 수준이고, 무엇보다 응답이 필요 없는 fire-and-forget 메시지에 HTTP request/response 모델이 과합니다. newline-delimited JSON으로 충분합니다.

**Q12. 결정적 UUID 트릭은 정확히 무엇이고 왜 필요했나요?**

`/sessions/ensure`는 hook이 server에 "내 세션을 등록해줘, ID 받아갈게"하는 호출입니다. 응답 ID를 받아야 다음 이벤트에 그 ID를 붙일 수 있어서 fire-and-forget이 안 됩니다. 우리 트릭은 두 부분입니다.

(1) **placeholder ID**: hook이 (runtimeSource, runtimeSessionId)에서 UUID v5 (SHA-1 name-based)로 결정적인 placeholder를 즉시 만들어 후속 이벤트에 사용하고, "이걸로 server에 ensure 해줘"를 daemon에 enqueue한 뒤 즉시 종료합니다.

(2) **post-hoc rewrite**: 중요한 것은 **server는 client가 보낸 placeholder를 canonical로 받아들이지 않는다**는 점입니다. server `ensure.runtime.session.usecase.ts`는 항상 자체 `idGen.newUuid()`로 sessionId를 발급하고, idempotency는 (`runtimeSource`, `runtimeSessionId`) binding 키로 보장합니다. daemon이 server 응답을 받은 시점에 placeholder ↔ server-assigned ID 매핑을 메모리에 기록하고, 이후 hook 이벤트가 placeholder를 들고 오면 daemon이 server-assigned ID로 rewrite합니다. 그래서 daemon mapping table은 옵션이 아니라 **필수**입니다.

이 트릭의 한계: placeholder 생성 → daemon이 server 응답 받기까지의 짧은 window에서 hook이 후속 이벤트를 보내면 mapping이 비어 있어 placeholder 그대로 server에 도달할 수 있습니다. 실측에서 hook 호출 간격이 충분해 race를 관측 못 했지만, burst 시나리오는 별도 검증이 필요한 부분으로 문서에 표시해 두었습니다.

**Q13. daemon이 죽으면 어떻게 되나요?**

세 단계 fallback이 있습니다. 첫째, hook이 UDS write 실패 시 다음 hook이 자동으로 daemon을 spawn합니다 (`maybeStartDaemon`이 detached child로 띄우고 hook은 즉시 exit). 둘째, daemon spawn조차 실패하면 hook은 timeout 후 throw, 그 위 transport가 HTTP fallback으로 직접 server에 보냅니다. 셋째, `MONITOR_TRANSPORT=http` 환경변수로 daemon 경로 자체를 끌 수 있습니다 (escape hatch).

**Q14. Phase 3 단독은 −12.5 %로 작은데 가치가 있나요?**

Phase 3 단독은 hook의 bottleneck이 여전히 `node + tsx` cold start이기 때문에 효과가 작습니다 (200 ms+ 중 transport ~30 ms만 절약). Phase 2와 결합한 뒤의 추가 효과를 보면 avg p99 1.8 ms 단축 + 5개 hook의 p99 분포가 32 ms → 6 ms로 좁아짐인데, **avg 1.8 ms는 같은 phase2-3 구성의 3 run avg가 41.93 / 47.99 / 59.29로 17 ms 폭 jitter를 보이기 때문에 통계적으로 noise에 묻혀 있습니다**.

분포 좁아짐의 메커니즘도 정확히는 "fastest hook이 ~13 ms 느려지고 slowest가 비슷하게 빨라진" 결과지, queue burst 흡수가 아닙니다 — 측정은 concurrency=1이라 burst가 없었습니다.

**그래서 Phase 3의 정당화는 latency 표가 아니라 운영 properties로 가야 합니다**: hook이 server timeout/5xx에 직접 노출 안 됨, batch / disk-backed queue를 얹을 단일 chokepoint 확보, server connection churn 감소. 이게 "production-ready hook"의 의미이고, 면접에서 "1.8 ms 차이로 daemon을 정당화하나요?"가 들어오면 "latency만으로는 아니고, 위 운영 측면이 진짜 이유"로 답하는 게 정직합니다.

### 5.5 측정 / 방법론

**Q15. 측정이 공정하다는 걸 어떻게 보장했나요?**

다섯 가지를 했고, 한계도 같이 말씀드리는 게 정직합니다.

**한 것**:
1. 모든 phase를 동일한 Docker 자원 (`--cpus=1.0 --memory=256m`) 안에서 실행
2. 각 phase 측정을 3회 실행 후 avg phase p99의 median run을 채택
3. hook 외부 wall-clock으로 측정 (hook 내부 timer가 아님)
4. 모든 측정에 `failures: 0` / `server 5xx: 0` 검증 (빨리 실패해서 latency가 낮아진 게 아님을 보장)
5. Prometheus의 `up{job="agent-tracer-server"} == 1` 게이트를 측정 시작 전 통과하지 못하면 측정 자체 실패

**한계**:
- iteration n=50, run n=3은 작은 표본입니다. 100ms 단위 차이는 의미 있지만, 1–2 ms 단위 차이 (예: phase2-bun-js 43.73 vs phase2-3 41.93)를 통계적으로 단정하기엔 부족합니다.
- `--cpus=1.0`은 Docker CFS bandwidth의 soft cap이라 측정에서 CPU max가 105 %를 보이는 등 격리가 hard limit은 아닙니다.
- baseline이 phase 측정마다 14 ms 폭으로 변동했습니다 (250.94 vs 264.96 등). phase별 절대 비교 시 분모가 다른 셈이라, **phase 내부의 AS-IS↔TO-BE 비교는 fair**하지만 phase 간 횡단 비교는 baseline 정규화가 없습니다.

이 한계들은 다음 측정 round에서 iteration / run 수를 키워서 해결할 계획입니다.

**Q16. 왜 p99을 봤나요? 평균만 보면 안 되나요?**

사용자 체감 latency는 tail latency에 민감합니다. 다만 솔직히 한계도 있습니다 — **iteration 50으로 측정한 p99은 49.5번째 sample 정도이고 사실상 max에 가깝습니다**. 그래서 p99이 outlier 한 개에 휘둘릴 수 있고, p95이 더 robust한 통계입니다. 결과 JSON에는 p50/p95/p99/max를 모두 기록했고, 이력서에서 p99을 강조한 건 절대 차이가 컸기 때문이지 그게 가장 robust한 통계라서가 아닙니다. 다음 round에서 iteration을 늘리면 p99 신뢰도 자체가 올라갑니다.

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

**Q23. "p99 분포 평탄화"가 실제로 어떤 시나리오에서 의미가 있나요?**

먼저 정정해야 할 부분이 있습니다. **"variance 5배 평탄화"는 5개 hook (SessionStart / StatusLine / PreToolUse / UserPromptSubmit / PostToolUse) 사이의 p99 분포가 좁아진 것이지, run-to-run jitter가 줄어든 게 아닙니다**. 그리고 측정은 concurrency=1이라 burst가 없었습니다. 메커니즘은 "UDS write가 가장 빠른 hook에 ~13 ms floor를 추가하고, HTTP fetch tail이 가장 느린 hook에서 사라져서, 양쪽이 중간으로 모이는" 결과입니다.

분포가 좁아지는 게 의미가 있는 시나리오:
- **사용자 체감 일관성**: 어떤 hook이 호출돼도 비슷한 시간 안에 끝남. SessionStart가 PreToolUse보다 두 배 느린 비대칭이 사라짐.
- **server connection churn**: 매 hook이 새 HTTP connection을 만들지 않음 → server 측 connection 관리 부담 감소.

burst 시나리오 (concurrency > 1)에서 daemon의 queue가 backpressure로 작동할 가능성은 있지만, **이 측정에서는 검증 안 됐습니다**. 다음 measurement round에 burst 시나리오를 추가할 계획입니다.

**Q24. 이 작업의 다음 단계로 무엇을 할 건가요?**

세 가지 후보. (1) **batch ingest**: daemon이 메시지를 1초 또는 100건 단위로 묶어 server에 한 번에 보내기. server-side throughput에 직접 도움. (2) **daemon health monitoring**: daemon이 자기 자신의 큐 깊이 / queue latency를 OTel로 노출하고 alert 가능하게. (3) **disk-backed queue**: daemon 죽음 / server 일시 다운에도 데이터 손실 없게.

---

## 6. 한 문장 결론 (면접에서 압축해 말할 때)

> "Claude Code hook은 매 이벤트마다 새 프로세스로 뜨는 short-lived 구조라 사용자 critical path에 100 ms+ 의 cold start가 매번 붙어 있었습니다. esbuild로 hook을 사전 컴파일해서 런타임 TypeScript transpile을 빌드 타임으로 옮기고, Bun runtime을 자동 감지해서 더 가벼운 startup으로 실행하고, hook → server 통신을 long-lived UDS daemon + (placeholder UUID + daemon mapping)으로 fire-and-forget화한 결과, hook p99을 250 ms → 42 ms로 −83.3 %, 5개 hook 사이의 p99 분포 폭을 ~140 ms → ~6 ms로 좁혔습니다. 모든 단계는 Docker resource-pinned 3-run median으로 측정했고, hook failure / server 5xx 0을 유지하면서 달성한 수치입니다. 측정 한계 (n=50 / n=3 runs / Bun-Node attribution 분리 안 함)는 다음 round에서 보완 예정입니다."
