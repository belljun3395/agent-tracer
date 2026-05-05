# 자체 비판적 검토 (Honest Review)

> 이 문서는 시니어 개발자 시선으로 본인 작업을 critical assessment한 것이다.
> 면접에서 "당신 작업의 한계는?"이 들어왔을 때 솔직히 답할 수 있도록,
> 그리고 다음 measurement round에서 무엇을 보완해야 하는지를 명확히 하기 위함.

---

## 1. 측정 방법론의 약점

### 1.1 `n=50 iteration + p99` 조합

각 hook을 50회 측정 후 p99을 보고했다. **p99 = 49.5번째 sample이라 사실상 max에 가깝다**. outlier 한 개에 휘둘림. 진짜 tail-latency는 n ≥ 1000이 필요. 현재 문서 모든 곳의 p99 수치는 "**max-ish**"로 받아들여야 정확하다. p95이 더 robust.

### 1.2 `n=3 runs` 로 작은 차이를 주장

phase2-3 결합본의 3 run 결과:
```
run 1: 41.93 ms
run 2: 47.99 ms
run 3: 59.29 ms
```
**range 17 ms**. phase2-bun-js 단독(43.73)과 phase2-3(41.93)의 1.8 ms 차이는 noise 안에 묻힘. "Phase 2+3이 phase2-bun-js보다 빠르다"는 통계적 주장은 이 sample로는 못 함. 정직한 표현은 "**latency는 두 구성에서 통계적으로 구별되지 않음**".

### 1.3 `--cpus=1.0` 의 soft cap 문제

Docker `--cpus=1.0` 은 CFS bandwidth의 soft cap이라 burst가 100%를 넘을 수 있다. 실측에서 CPU max 105.61% 관측. 즉 **fixed-resource environment라고 부르기엔 통제가 느슨함**. 진짜 격리는 cgroup v2 `cpu.max` hard limit 또는 NUMA pinning.

### 1.4 baseline drift

각 phase의 baseline 측정값이 다름:
- phase2-node-js baseline: 264.96 ms
- phase2-bun-ts baseline: 250.44 ms
- phase2-bun-js baseline: 252.77 ms
- phase3 baseline: 245.07 ms
- phase2-3 baseline: 250.94 ms

같은 AS-IS 코드인데 14 ms 폭. 각 phase 내 비교는 fair, **횡단 비교는 baseline 정규화 부재**. summary 문서의 "Phase 2 best는 bun-js"는 절대값 비교라 약점.

---

## 2. 인과관계 추론의 약점

### 2.1 Node vs Bun attribution

측정으로 확인된 것: **`bun + 컴파일 JS` 가 `node + 컴파일 JS`보다 hook p99이 78 → 44 ms로 약 44 % 빠름**. 이건 사실.

**측정으로 확인 안 된 것**:
- 이 차이가 JS 엔진 (JSC vs V8) 때문인가?
- Bun core가 native (Zig)이라서?
- ESM resolver 차이?
- GC 전략?
- 표준 라이브러리 fast path?

위 5개 후보의 기여도를 분리하는 micro-benchmark를 안 했다. 문서는 "plausible attribution"이라고 표시했지만, **사실 narrative가 측정 데이터보다 한참 멀리 나가 있다**. 면접에서 정밀한 attribution을 요구받으면 "그건 측정 안 했다"가 정직한 답.

### 2.2 variance 평탄화 메커니즘

이전 문서에선 "burst 흡수"로 설명했음 — 측정은 concurrency=1이라 **burst가 없었기 때문에 그 설명은 틀림**. 정정 후 현재 문서 메커니즘은 "fastest hook에 ~13 ms floor 추가 + slowest hook의 HTTP tail 제거 = 분포가 중간으로 좁아짐". 이건 측정 데이터와 일치.

burst 시나리오에서의 daemon backpressure 효과는 가능성은 있지만 **이번 작업에서 검증 안 됨**. concurrency 변수를 키운 측정 round가 필요.

### 2.3 server p99 증가의 attribution

TO-BE에서 `/sessions/ensure` p99이 4.97 → 21.25 ms로 4배 증가. 가능한 후보:
- (a) hook이 빨라져 burst 도착
- (b) daemon HTTP keep-alive가 server connection state를 더 길게 유지
- (c) Prometheus scrape window의 sampling artifact
- (d) 단순 noise (server p99 측정도 sample 작음)

**원인 분리 안 함**. 이전 문서엔 (a)로 단정했지만 정직하게는 후보들의 합성 가능성을 인정해야 함.

---

## 3. 빠진 분석

### 3.1 "Phase 2 best of 3"는 best optimal이 아님

phase2-node-js의 78 ms는 추가 최적화 없이 측정한 첫 결과. 시도 안 한 것:
- V8 bytecode cache 또는 v8-compile-cache
- esbuild의 `splitting: true` + 공통 chunk
- bundle inline (`packages: undefined`)

따라서 "Phase 2 best는 bun-js"는 정확히는 "**측정한 3개 후보 중 best**"이고 "Phase 2 design space 전체의 best"는 아님. 면접에서 "Node에서 더 줄일 여지는?" 물으면 답 약함.

### 3.2 daemon failure mode 측정 부재

문서엔 "daemon이 죽으면 HTTP fallback"이 코드 인용으로 적혀 있지만 **실제로 죽인 시나리오 측정 안 함**:
- daemon kill 후 첫 hook latency? (재spawn + retry timeout = ~1초 예상)
- daemon hang(deadlock) 시 hook이 어떻게 되나?
- SIGKILL / OOM kill 시 큐 손실 정량화

production-readiness 주장하려면 fault injection 측정 필요.

### 3.3 hook payload 크기 영향

모든 hook을 작은 payload로 측정. 실제 PreToolUse는 tool 인자가 크면 payload가 KB 수준. **payload 크기에 따른 scaling 측정 없음**. UDS는 작은 메시지에 강하지만 large payload에선 socket buffer copy 비용이 보일 수도.

### 3.4 burst / concurrency 시나리오

`concurrency=1`로만 측정. daemon의 단일 큐가 burst 흡수에 도움 되는지는 검증 안 됨. 면접 "concurrency 늘리면 어떻게 되나요?" 답 없음.

---

## 4. 좋았던 부분 (공정하게)

- **3-run median harness** 자체는 좋은 패턴. 1회 측정 outlier 영향 줄임.
- **Prometheus `up` 게이트** — 측정 시점에 의존성 시스템이 정상인지 확인.
- **resource pinning 시도** — soft cap이지만 안 한 것보다는 나음.
- **commit hygiene** — 3-commit per phase + base squash + 모든 branch rebase 동기화.
- **deep-dive-tsx-to-compiled-js.md의 단계별 분해**는 사실에 가까움 (tsx 동작은 공개됨).
- **문서 구조** — phase-summary가 다른 4개로 cross-link, summary 브랜치 분리.
- **fault injection 시나리오 (bun container에 node 없는 daemon spawn 사고)를 발견하고 수정한 흔적** — measurement 자체가 production bug를 잡은 사례.

---

## 5. 면접 위험도 별 4단계 (n=200 × 5-runs 재측정 후 갱신)

| 항목 | 위험도 | 상태 |
|---|---|---|
| `n=50 + p99` sample size | 🟢 resolved | n=200으로 재측정 완료. p99이 outlier에 휘둘리는 정도가 줄었고, 본 측정의 일부 결론(특히 Phase 2+3 vs Phase 2 best 관계)이 명확해짐 |
| Phase 2+3 권장의 1.8 ms 차이 | 🟢 resolved | 재측정에서 phase2-3(35.38)이 phase2-bun-js(34.28)보다 약간 느린 것이 확인. 권장 구성 변경 + Phase 3 가치 재정의 (multi-user broker로) |
| `--cpus=1.0`인데 CPU max ~105 % | 🟡 medium | 여전히 soft cap. cgroup v2 hard limit 도입은 다음 round 후보 |
| Bun vs Node attribution | 🟡 medium | 측정으로는 "Bun 런타임 전체 > Node 런타임 전체"까지만. JSC / Bun core / ESM resolver / GC 분리 측정 안 함 |
| **Multi-user 시나리오 부재** | 🔴 NEW high | 이번 측정의 새로 드러난 한계. Phase 3 가치를 못 잡는 환경에서 측정함. 다음 round의 핵심 |
| variance 평탄화 인과 설명 | 🟢 resolved | concurrency=1 사실 반영 + n=200 재측정에서 분포 범위가 더 정밀하게 측정됨 |
| UUID v5 server idempotency | 🟢 resolved | server 코드 확인 후 placeholder + post-hoc rewrite로 정정 |
| baseline drift | 🟢 mostly resolved | sweep 5 baseline 측정의 mean±stddev로 표현. phase2-node-js가 sweep 첫 phase의 cold-cache outlier로 287 ms (다른 4 phase는 230 ± 3 ms로 안정) |
| daemon failure mode 측정 부재 | 🟡 medium | 코드 fallback 있음. 정량화 (latency, recovery time, data loss rate)는 다음 round |

---

## 6. n=200 재측정에서 새로 확인된 사실

이번 round에서 확정된 것:

1. **Phase 2 best (bun + 컴파일 JS)가 단독으로 −85.4 % 개선**. 이전 −82.7 %보다 약간 더 큰 개선.
2. **Phase 2+3은 latency 우위 없음** (-84.6%). 이전 의심 → 확정.
3. **Phase 3 단독 −13.7 %로 일관** (이전 -12.5%, 거의 같음). transport 절약 비중이 작은 건 안정적인 발견.
4. **mean±stddev로 통계적 안정성 확인**: phase2-bun-ts (5.82), phase3 (3.61), phase2-3 (3.25)는 매우 안정. phase2-bun-js (8.30)도 안정. phase2-node-js (81.17)는 sweep 첫 phase cold-cache outlier 영향.

이번 round에서 새로 보인 한계:
- **Multi-user 시나리오 측정 부재가 결정적**: Phase 3는 단일 사용자 self-hosted에서는 쓸모 없는 게 데이터로 확인. 그러나 daemon = 사용자별 이벤트 broker로서의 가치는 multi-user 측정 없이는 정량화 불가. 이게 다음 round의 #1 우선순위.

## 7. 다음 measurement round의 우선순위 (갱신)

| 우선순위 | 항목 | 이유 |
|---|---|---|
| **#1 Must do** | concurrency 4 / 8 / 16 시나리오 | Phase 3의 본질적 가치 (server connection / TLS / batching) 측정. 단일 사용자 측정만으로는 결론 내릴 수 없음 |
| **#2 Must do** | multi-host (혹은 host network simulation) | server-side connection churn 정량화. 단일 호스트 loopback으론 안 잡힘 |
| **#3 Should do** | runtime startup-only micro-bench | Bun-Node attribution 분리 (JSC vs V8 vs stdlib vs GC) |
| **#4 Should do** | daemon fault injection (kill, hang, OOM) | production-readiness 정량화 |
| **#5 Should do** | TLS 활성 환경 측정 | TLS handshake amortization 효과 검증 (production 가정) |
| **#6 Nice to do** | payload size scaling (1 KB, 10 KB, 100 KB) | UDS large message 영향 |
| **#7 Nice to do** | cgroup v2 hard cpu limit | 측정 격리 강화 |

---

## 8. 한 문장 결론 (n=200 재측정 후)

> **이전 measurement round의 narrative를 재측정으로 검증·정정하는 과정에서 가장 큰 발견은 "Phase 3는 단일 사용자 self-hosted에서는 쓸모가 없다"였다. 이는 작업의 실패가 아니라 측정 환경의 한계를 정직히 드러낸 것이고, daemon의 진짜 가치는 multi-user 시나리오의 server-side scalability에 있다는 reframe을 만들어냈다. 다음 round에서 검증할 가설이 명확해졌고, 이력서/면접 자료의 narrative는 이번 측정으로 입증된 사실 안에서만 주장하도록 정리됨.**