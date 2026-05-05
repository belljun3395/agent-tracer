# Agent Tracer — Phase Summary

> 2026-05-05 재측정 (n=200, 5 runs × 5 phases) 데이터 기반.
> 이전 n=50 × 3 runs 측정의 결론 일부가 통계적으로 더 명확해짐.

## 결론

**최종 권장 구성: `bun + compiled JS` (Phase 2 best, phase2-bun-js)**

> 이전엔 `bun + compiled JS + UDS daemon` (Phase 2+3) 권장이었음. 새 측정에서
> 결합본(-84.6%)이 Phase 2 단독(-85.4%)보다 약간 작거나 동등 — daemon이
> 단일 사용자 self-hosted 시나리오에서 latency 우위를 주지 않음을 확인.
> Phase 3 (UDS daemon)의 본질적 가치는 multi-user / server-side scalability에 있음 (§Phase 3 가치 재정의 참조).

| 지표 | AS-IS | Phase 2 best | Phase 2+3 | Δ (Phase 2 기준) |
|---|---:|---:|---:|---:|
| **Avg hook p99 (ms)** | 229.67 | **34.28** | 35.38 | **−85.4 %** |
| Mean ± stddev (5 runs) | n/a | 137.69 ± 8.30 | 134.24 ± 3.25 | — |
| SessionStart p99 | 251.4 | 40.8 | 40.2 | −83.8 % |
| StatusLine p99 | 242.7 | 39.4 | 34.9 | −83.8 % |
| PreToolUse p99 | 203.9 | 31.6 | 33.0 | −84.5 % |
| UserPromptSubmit p99 | 204.9 | 20.9 | 32.3 | −89.8 % |
| PostToolUse/Bash p99 | 245.6 | 38.8 | 36.4 | −84.2 % |
| CPU avg (%) | 99.93 | 84.86 | 100.59 | −15 pp / +0.7 pp |
| Memory avg (MiB) | 71.43 | 41.36 | 59.10 | −42 % / −17 % |

## 측정 환경

- Docker resource: 서버 `1 vCPU / 512 MiB`, 벤치 컨테이너 `--cpus=1.0 / --memory=256m`
- Hooks: `SessionStart`, `StatusLine`, `PreToolUse`, `UserPromptSubmit`, `PostToolUse/Bash`
- 각 hook × **200 iterations + 20 warmup**, concurrency 1
- **5회 실행 후 avg phase p99의 median run 채택**
- Median artifacts: 각 phase 측정 log의 `Median artifact:` 라인
- Sweep: `observability/results/sweep-2026-05-05T02-40-03Z/` (총 2시간 20분)
- Server: NestJS + OTel auto-instrumentation, Prometheus scrape interval 5s

## 단계별 측정 결과 (5-run mean ± stddev)

| Phase | 변경 | Median p99 | Mean ± stddev | 누적 Δ |
|---|---|---:|---:|---:|
| AS-IS | node + tsx + HTTP | 229.67 | n/a | — |
| Phase 2: node + 컴파일 JS | esbuild precompile + node | 77.70 | 209.27 ± 81.17 | −66.2 % |
| Phase 2: bun + TS | bun runtime, TS native | 41.26 | 139.76 ± 5.82 | −82.0 % |
| **Phase 2: bun + 컴파일 JS** | bun + precompile (best) | **34.28** | 137.69 ± 8.30 | **−85.1 %** |
| Phase 3: node+tsx + UDS daemon | 단독 적용 | 198.98 | 214.95 ± 3.61 | −13.4 % |
| Phase 2+3: bun + 컴파일 JS + UDS | 결합 | 35.38 | 134.24 ± 3.25 | −84.6 % |

> phase2-node-js의 mean은 sweep 첫 phase의 cold-cache outlier(run 1: 350)
> 때문에 큼. median은 안정적.

## 무엇이 빨라졌나

| 변경 | 절감되는 비용 |
|---|---|
| `tsx` 제거 → `bun` runtime | 매 호출마다 들이던 TypeScript transpile + ESM loader 비용 (~150–200 ms) |
| Hook 소스 → `esbuild`로 미리 번들된 JS | bun도 parser/typecheck 안 함; cold start floor ~30 ms |
| HTTP `fetch` → UDS daemon (Phase 3) | 단일 사용자 self-hosted에선 미미. multi-user에서 본질적 (§Phase 3 가치 참조) |

## ⚠️ Phase 3 가치 재정의 — 단일 사용자 측정의 한계

이번 sweep에서 Phase 2+3 결합본(-84.6%) ≤ Phase 2 단독(-85.4%)이 확인됨.
**이는 Phase 3가 잘못된 게 아니라 측정 환경이 Phase 3의 가치를 못 잡는 것**.

### 시나리오 A: Self-hosted (이번 측정)

```
[사용자 노트북]
  hook process × M → server (loopback HTTP) → DB
```

hook과 server가 같은 머신이라 HTTP loopback의 transport 비용 자체가 작음
(~5 ms /sessions/ensure). daemon이 UDS로 절감하는 IPC 비용도 작음. 결과:
**Phase 3는 latency를 추가로 줄이지 않고, 메모리 +40 MB만 늘림**.

### 시나리오 B: Multi-user / SaaS (측정 안 됨)

```
[사용자 1]  hook × M → daemon₁ ─┐
[사용자 2]  hook × M → daemon₂ ─┼─→ 원격 server → DB
[사용자 N]  hook × M → daemonₙ ─┘
```

여기서 daemon = **사용자별 이벤트 브로커**:
- 사용자별로 daemon이 1개 떠 있고, 그 사용자의 모든 hook 트래픽을 흡수
- Daemon이 server에 long-lived keep-alive HTTP connection 1개로 보냄
- Hook이 직접 server 호출 시: N×M개의 short-lived TCP/TLS handshake
- Daemon 경유 시: N개의 long-lived connection (사용자당 1개)

**Server-side에서 측정해야 할 절감**:
- Connection churn: N×M → N (사용자당 1)
- TLS handshake 비용: 호출당 → daemon 시작당 1회
- Daemon이 batch하면 server RPS 감소 (예: 100 events/min → 1 batch/min)
- 사용자 daemon이 retry / disk-backed queue를 가지면 server 일시 다운 흡수

이 시나리오의 측정은 이번 sweep에 없음. **Phase 3의 정당화는 latency 표가
아니라 server-side scalability에 있다**는 것이 정확한 framing.

## 의사결정 요약

| 옵션 | Avg hook p99 | 복잡도 | 추천 시나리오 |
|---|---:|---|---|
| AS-IS | 229.67 | 0 | — |
| Phase 2: node + 컴파일 JS | 77.70 | 낮음 (esbuild 추가) | 단순함 우선, Bun 의존성 회피 |
| Phase 2: bun + TS | 41.26 | 중간 (bun 도입) | TypeScript 소스 그대로 두고 싶을 때 |
| **Phase 2: bun + 컴파일 JS** | **34.28** | 중간 | **단일 사용자 self-hosted: 가장 빠름** |
| Phase 3: node + tsx + UDS daemon (단독) | 198.98 | 높음 | 권장 안 함 (Phase 2 없이는 cold start floor 못 풂) |
| Phase 2+3: bun + 컴파일 JS + UDS | 35.38 | 높음 (daemon 운영) | **Multi-user / SaaS 시나리오**: server-side 보호 |

## 측정의 한계 — 솔직하게

| 한계 | 영향 | 다음 round 보완 |
|---|---|---|
| **Multi-user / concurrency > 1 시나리오 부재** | Phase 3의 본질적 가치 (server-side scalability)를 못 잡음 | concurrency 4/8/16 + multi-host 시나리오 추가 |
| `--cpus=1.0` soft cap | CPU max 100-105% 관측 — hard limit 아님 | cgroup v2 hard limit |
| Bun-Node attribution | "Bun 런타임 전체가 Node보다 빠르다" 까지만 입증 | runtime-startup micro-bench (minimal hook) |
| Server p99 변동 (4.97 → 17.71 ms) | 원인 단정 못 함 (burst arrival vs keep-alive vs noise) | concurrency 변수로 분리 |
| daemon failure mode 측정 부재 | 코드 fallback 있음, 정량화 안 됨 | kill / hang / OOM fault injection |

## 더 깊이 들어가는 자료

- [`deep-dive-tsx-to-compiled-js.md`](deep-dive-tsx-to-compiled-js.md) — tsx 런타임 트랜스파일이 short-lived hook에서 비싼 이유
- [`deep-dive-node-vs-bun.md`](deep-dive-node-vs-bun.md) — Node와 Bun의 일반적 차이 + 우리 측정의 attribution 한계
- [`deep-dive-uds-daemon.md`](deep-dive-uds-daemon.md) — UDS daemon 구조, placeholder UUID + post-hoc daemon mapping, **multi-user 시나리오에서의 가치**
- [`resume-and-interview.md`](resume-and-interview.md) — 프로젝트 소개 / 라이브러리 선택 / 측정 수치 / 면접 Q&A
- [`honest-review.md`](honest-review.md) — 본인 작업의 critical assessment
