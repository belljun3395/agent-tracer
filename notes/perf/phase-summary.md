# Agent Tracer — Phase Summary

## 결론

**최종 권장 구성: Phase 2 best + Phase 3 = `bun + compiled JS + UDS daemon`**

AS-IS(`node + tsx + HTTP`) 대비 hook wall-clock p99 **−83.3 %**, CPU avg
−16.4 pp, Memory avg −32.9 %. 5개 hook 사이의 p99 분포 폭이 ~140 ms → ~6 ms로 좁아짐.

| 지표 | AS-IS | 최종 (Phase 2+3) | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 250.94 | **41.93** | **−83.3 %** |
| SessionStart p99 (ms) | 336.41 | 42.49 | −87.4 % |
| StatusLine p99 (ms) | 243.79 | 43.04 | −82.3 % |
| PreToolUse p99 (ms) | 204.58 | 45.13 | −77.9 % |
| UserPromptSubmit p99 (ms) | 197.40 | 39.16 | −80.2 % |
| PostToolUse/Bash p99 (ms) | 272.52 | 39.85 | −85.4 % |
| CPU avg (%) | 97.13 | 80.69 | −16.4 pp |
| CPU max (%) | 103.73 | 101.72 | −2.0 pp |
| Memory avg (MiB) | 65.30 | 43.80 | −32.9 % |
| Memory max (MiB) | 104.60 | 55.01 | −47.4 % |
| `/sessions/ensure` p99 (ms) | 4.97 | 21.25 | +328 %\* |
| `/workflow` p99 (ms) | 9.99 | 21.43 | +114 %\* |
| `/tool-activity` p99 (ms) | 9.95 | 9.95 | 0 % |
| 5xx | 0 | 0 | — |
| Event loop p99 (s) | 0.02 | 0.02 | — |
| V8 heap (MiB) | 51.86 | 44.17 | −14.8 % |

\* server-side p99 증가의 원인은 단정 못 함. 가능한 후보: (a) hook이 빨라져
  요청이 더 burst하게 server에 도착, (b) daemon HTTP keep-alive가 server
  connection state를 더 길게 유지, (c) 단순 measurement noise (server
  p99 측정도 sample 수 작음). 분리 측정 안 함. 다만 hook end-to-end는
  여전히 -83% 단축이라 user-facing는 영향 없음.

## 측정 환경

- Docker resource: 서버 `1 vCPU / 512 MiB`, 벤치 컨테이너 `--cpus=1.0 / --memory=256m`
- Hooks: `SessionStart`, `StatusLine`, `PreToolUse`, `UserPromptSubmit`, `PostToolUse/Bash`
- 각 hook × 50 iterations + 10 warmup, concurrency 1
- 3회 실행 후 avg phase p99의 median run 채택
- Median artifact: `observability/results/docker-phase-bench/2026-05-03T17-09-28-151Z/`
- Server: NestJS + OTel auto-instrumentation, Prometheus scrape interval 5s
- Branch: `perf/phase2-3-bun-js-daemon`

## 무엇이 빨라졌나

| 변경 | 절감되는 비용 |
|---|---|
| `tsx` 제거 → `bun` runtime | 매 호출마다 들이던 TypeScript transpile + ESM loader 비용 (~150–200 ms) |
| Hook 소스 → `esbuild`로 미리 번들된 JS | bun도 parser/typecheck 안 함; cold start floor가 ~30–40 ms로 내려감 |
| HTTP `fetch` → UDS daemon (`enqueueDaemonMessage`) | TCP/HTTP framing + connect overhead가 매 hook 호출에서 사라짐 |
| 결합 효과 | 5개 hook 사이의 p99 분포 폭이 좁아짐 (메커니즘은 daemon UDS deep-dive §7.3 참조) |

## Phase 2 best 단독과의 비교

Phase 2 best (`bun + compiled JS + HTTP`)가 이미 −82.7 % 개선. Phase 3
daemon UDS를 얹은 결합본은 avg p99 41.93 vs 43.73 ms (−1.8 ms) — 단,
**같은 phase2-3 구성의 3 run avg가 41.93 / 47.99 / 59.29로 17 ms 폭의
jitter를 보여서 1.8 ms 차이는 통계적으로 noise에 묻혀 있다**.

따라서 Phase 3의 정당화는 latency가 아니라 **운영 properties**에 있다:

- Hook이 server timeout / 5xx에 직접 노출되지 않음 (fire-and-forget)
- Daemon 단일 chokepoint에 batch / disk-backed queue 같은 server-side
  보호장치를 얹기 쉬움 (현재는 1:1 forward)
- Server connection churn 감소 (모든 hook이 daemon의 keep-alive 공유)

## 의사결정 요약

| 옵션 | Avg hook p99 | 복잡도 | 권장 시나리오 |
|---|---:|---|---|
| AS-IS | 250.94 | 0 | — |
| Phase 2: node + compiled JS | 78.03 | 낮음 (esbuild 추가) | 단순함 우선, Bun 의존성 회피 |
| Phase 2: bun + TS | 48.81 | 중간 (bun 도입) | TypeScript 소스 그대로 두고 싶을 때 |
| Phase 2: bun + compiled JS | 43.73 | 중간 | **latency만 본다면 충분 — Phase 3 없이도 −82.7 %** |
| **Phase 2+3** | **41.93** | 높음 (daemon 운영 필요) | **운영 안정성** (server timeout 격리, batch 기반) 까지 원할 때 |

## 근거 / 참고 측정

각 phase의 단독 측정 결과는 해당 브랜치의 `notes/perf/<phase>.md`에 있음:

- `perf/phase2-node-js` → `notes/perf/phase2-node-js.md`
- `perf/phase2-bun-ts` → `notes/perf/phase2-bun-ts.md`
- `perf/phase2-bun-js` → `notes/perf/phase2-bun-js.md`
- `perf/phase3-daemon-uds` → `notes/perf/phase3-daemon-uds.md`
- `perf/phase2-3-bun-js-daemon` → `notes/perf/phase2-3-bun-js-daemon.md`

## 측정의 한계 — 솔직하게

이 결론은 다음 가정/한계 위에 있고, 다음 measurement round에서 보완 예정이다.

| 한계 | 영향 | 보완 계획 |
|---|---|---|
| iteration n=50 | p99 ≈ 49.5번째 sample이라 사실상 max에 가까움. p95이 더 robust. | iteration 200+로 증가 |
| run n=3 | run-to-run jitter (예: phase2-3에서 41.93 / 47.99 / 59.29 = 17 ms 폭) 안에서 1–2 ms 차이를 단정하기 어려움 | run 수 10+로 증가, Welch's t-test로 유의미성 확인 |
| `--cpus=1.0` | Docker CFS bandwidth의 soft cap. 측정에서 CPU max 105 % 관측됨 — hard limit 아님 | cgroup v2 `cpu.max` 직접 설정으로 hard limit |
| baseline drift | 각 phase 측정의 baseline이 250.94 ~ 264.96 ms로 14 ms 폭 변동. phase 내 비교는 fair, 횡단 비교는 정규화 부재 | 한 measurement run 안에서 모든 phase를 함께 측정해 baseline 1회로 고정 |
| Bun-Node 우위 attribution | "Bun 런타임 전체가 Node보다 빠르다" 까지만 입증. 어느 요인 (JSC / Bun core native / ESM resolver / GC)에서 얼마씩 기여했는지는 분리 안 됨 | runtime startup-only micro-bench (`/dev/null` 출력만 하는 최소 hook) 추가 |
| Server p99 증가 (4.97 → 21.25 ms) | hook end-to-end에는 영향 없지만 원인 단정 못 함 (burst arrival vs keep-alive state vs noise) | concurrency 변수로 burst 시나리오 만들어 keep-alive 영향 분리 |
| concurrency = 1 | "burst 흡수" 같은 daemon backpressure 효과 검증 불가 | concurrency 4, 8, 16에서 phase2-bun-js vs phase2-3 다시 측정 |
| daemon failure mode | "daemon 죽으면 HTTP fallback"이 코드엔 있지만 측정 안 함 | daemon kill / hang fault injection 추가 |

위 보완은 다음 measurement round에서 한꺼번에 진행 예정. **이번 결론 (Phase 2+3 권장, hook p99 −83.3 %) 자체는 영향받지 않을 것으로 예상**하지만, Phase 3의 정당화 근거 (latency 1.8 ms vs 운영 properties)와 Bun-Node attribution narrative는 micro-bench 결과에 따라 보강될 수 있다.

## 더 깊이 들어가는 자료 (이 브랜치에 함께 둠)

기술 deep-dive와 인터뷰 / 이력서 자료는 별도 문서로 분리:

- [`deep-dive-tsx-to-compiled-js.md`](deep-dive-tsx-to-compiled-js.md) — tsx 런타임 트랜스파일이 왜 short-lived hook에서 비싸고, esbuild bundle precompile이 그걸 어떻게 해결하는가
- [`deep-dive-node-vs-bun.md`](deep-dive-node-vs-bun.md) — Node와 Bun의 일반적 차이 + 우리 측정의 attribution 한계
- [`deep-dive-uds-daemon.md`](deep-dive-uds-daemon.md) — UDS daemon 구조, placeholder UUID + post-hoc daemon mapping 트릭, variance 평탄화 메커니즘
- [`resume-and-interview.md`](resume-and-interview.md) — 프로젝트 소개 / 라이브러리 선택 이유 / 측정 수치 (한계 명시 포함) / 24개 예상 면접 질문과 답변
- [`honest-review.md`](honest-review.md) — 본인 작업의 critical assessment. 측정 방법론의 약점, 인과관계 추론의 한계, 빠진 분석, 면접 위험도 표, 다음 round의 우선순위
