# Phase 2 + 3: bun + compiled JS + UDS daemon

## 개요

Phase 2 best (`bun + compiled JS`)과 Phase 3 (UDS daemon)을 결합:
- **Hook 실행**: bun이 미리 esbuild로 번들링된 JS hook을 직접 실행 (Phase 2)
- **Server 통신**: hook이 long-lived daemon에 UDS로 메시지 enqueue → daemon이
  HTTP로 server에 전달 (Phase 3)

## 측정 (2026-05-05, n=200, 5 runs)

**median run**: `2026-05-05T04-50-53-839Z`

### 5-run 안정성

| run | score (avg phase p99 ms) |
|---|---:|
| run 1 | 132.41 |
| run 2 | 139.95 |
| run 3 | 133.91 |
| run 4 | 132.53 ← MEDIAN |
| run 5 | 132.44 |

Mean ± stddev: **134.24 ± 3.25 ms (n=5)** — 매우 안정적

### Hook Wall-Clock p99 (ms) — median run

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 251.4 | 242.7 | 203.9 | 204.9 | 245.6 | 229.67 |
| bun + compiled JS + UDS daemon (TO-BE) | 40.2 | 34.9 | 33.0 | 32.3 | 36.4 | **35.38** |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 99.93 / 103.46 | 71.43 / 106.90 | 9.89 | 9.91 | 9.97 | 0 | 0.02 | 52.13 |
| bun + compiled JS + UDS daemon (TO-BE) | 100.59 / 104.76 | 59.10 / 75.49 | 9.95 | 17.71 | 9.99 | 0 | 0.05 | 52.39 |

### AS-IS 대비 개선율

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 229.67 | 35.38 | **−84.6 %** |
| CPU avg (%) | 99.93 | 100.59 | +0.66 pp |
| Memory avg (MiB) | 71.43 | 59.10 | **−17.3 %** |

## ⚠️ Phase 2 단독 vs 결합본 — 핵심 발견

| Variant | Avg hook p99 | Mean ± stddev | Δ vs AS-IS |
|---|---:|---:|---:|
| Phase 2 best (`bun + compiled JS`) | **34.28** ms | 137.69 ± 8.30 (n=5) | **−85.4 %** |
| **Phase 2+3 (`bun + compiled JS + UDS`)** | **35.38** ms | 134.24 ± 3.25 (n=5) | **−84.6 %** |

**결합본이 Phase 2 단독보다 약간 느림 (1.10 ms 차이, mean 기준 3.45 ms 차이).**
이전 n=50 측정에서 의심했던 "1.8 ms 차이는 noise에 묻혀 있음" 가설이
n=200 × 5 runs 측정에서 명확히 확인됨:

- Phase 2 단독 mean (137.69) > Phase 2+3 mean (134.24) — score 평균은
  결합본이 약간 더 빠름. 하지만 median run으로 보면 Phase 2 단독이 빠름.
- 두 분포의 stddev (8.30 vs 3.25)를 고려할 때 **두 구성은 latency에서
  통계적으로 구별되지 않음**.

## Phase 3의 진짜 가치 — multi-user 시나리오

이 측정 (단일 사용자 self-hosted, hook과 server가 같은 머신)에서는
daemon이 latency 단축에 기여하지 않음. **그러나 production 배포 시나리오는
단일 사용자가 아니다**:

### 시나리오 A: Self-hosted (현재 측정)
```
[사용자 노트북]
  hook process × N → server (loopback HTTP) → DB
                  → daemon → server (loopback HTTP) → DB
```
hook과 server가 같은 머신이라 transport 비용 자체가 작음. daemon의 IPC
절감 효과 미미.

### 시나리오 B: Multi-user / SaaS
```
[사용자 1]  hook × M → daemon (사용자 1 로컬) ─┐
[사용자 2]  hook × M → daemon (사용자 2 로컬) ─┼→ 원격 server → DB
[사용자 N]  hook × M → daemon (사용자 N 로컬) ─┘
```

여기서 daemon은 **사용자별 이벤트 브로커** 역할:
- N×M개의 short-lived HTTP connection (사용자 직접 server 호출 시)
  → N개의 long-lived keep-alive connection (사용자 daemon만 server 호출)
- Daemon이 batch / aggregation으로 server RPS 감소 가능 (예: 100
  events/min을 1 batch/min으로)
- Server connection churn 대폭 감소 → server CPU / memory 부담 감소
- TLS handshake 비용도 사용자당 1회로 amortize (TCP의 경우)

**즉 daemon의 가치는 hook latency가 아니라 server-side scalability에 있다**.
이번 측정은 시나리오 A의 측정이라 그 가치가 안 잡힘.

### 검증되지 않은 부분

- Multi-user (concurrency > 1, 다른 호스트) 트래픽에서 daemon batching의
  실제 server RPS 절감
- 사용자당 daemon 1개 + N명 = N daemon vs N×M hook의 server 부하 비교
- TLS handshake 절감 효과 정량화 (현재 측정은 HTTP loopback이라 TLS 없음)

## 분석

- **단일 크리티컬 path는 Phase 2**. Hook 실행 cold start의 비용(node+tsx
  → bun+compiledJS)이 가장 큰 절감 요인 (-85% 중 거의 전부).
- **Phase 3는 latency 관점에선 중립적**. daemon UDS write의 floor가
  HTTP fetch tail 제거와 거의 상쇄.
- **Phase 3의 정당화는 운영적**: server 측 scalability, fire-and-forget의
  안정성 (server timeout이 hook에 전파 안 됨), batch / disk-backed queue
  추가 가능성 — 이번 측정에서는 검증 안 됐지만 production 시나리오에서는
  중요할 수 있음.

## 한계

- Hook latency floor ~35 ms는 거의 bun process startup 비용. 더 줄이려면
  long-lived hook process (Phase 4 후보) 또는 in-process hook execution.
- Daemon의 메모리 상주 ~22 MiB는 hook 호출 빈도가 낮은 워크로드에서는
  과한 비용일 수 있음.
- Multi-user 시나리오 측정 부재 (다음 measurement round 후보).
