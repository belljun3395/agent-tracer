# Phase 3: node + tsx + UDS daemon

## 개요

Hook 호출 transport를 HTTP에서 **Unix Domain Socket(UDS) daemon**으로 전환.
Long-lived daemon이 메모리에 떠 있고, 매 hook은 UDS로 daemon에 일을
던지고 받아옴. 런타임은 그대로 `node + tsx` (Phase 2 개선 없이).

## 측정 (2026-05-05, n=200, 5 runs)

**median run**: `2026-05-05T04-00-03-005Z`

### 5-run 안정성

| run | score (avg phase p99 ms) |
|---|---:|
| run 1 | 214.80 ← MEDIAN |
| run 2 | 219.13 |
| run 3 | 217.55 |
| run 4 | 209.90 |
| run 5 | 213.38 |

Mean ± stddev: **214.95 ± 3.61 ms (n=5)** — 매우 안정적

### Hook Wall-Clock p99 (ms) — median run

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 256.2 | 245.4 | 204.7 | 201.5 | 245.3 | 230.61 |
| node + tsx + UDS daemon (TO-BE) | 198.1 | 194.4 | 201.1 | 199.9 | 201.5 | **198.98** |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 99.79 / 103.86 | 67.09 / 106.70 | 4.97 | 9.91 | 9.98 | 0 | 0.02 | 48.75 |
| node + tsx + UDS daemon (TO-BE) | 99.90 / 103.30 | 131.52 / 159.10 | 9.99 | 12.25 | 9.95 | 0 | 0.02 | 52.04 |

### AS-IS 대비 개선율

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 230.61 | 198.98 | **−13.7 %** |
| CPU avg (%) | 99.79 | 99.90 | +0.11 pp |
| Memory avg (MiB) | 67.09 | 131.52 | **+96.0 %** (daemon 상주 비용) |

## 분석

- 단독 효과는 -13.7% (이전 n=50 측정의 -12.5%와 일관). 이유:
  - Hook 시작 비용의 대부분(~230 ms 중 200 ms+)은 `node+tsx` cold start
  - Phase 3는 transport(HTTP→UDS)만 바꿈 → ~30 ms 정도만 절약
- Memory가 거의 2배 (67→132 MiB). daemon이 워커 풀과 함께 상주하기 때문.
  하지만 한 번 떠 있으면 모든 hook 호출이 그것을 공유.
- **5개 hook의 p99 분포가 매우 좁음** (194–201 ms): daemon이 모든 hook의
  transport overhead를 일정한 UDS write로 통일. 이는 phase2-3 결합본의
  "분포 평탄화" 메커니즘과 동일 (단일 사용자라도 hook 간 분포 평탄화는 진짜).

## Phase 3 단독 vs 결합

- **Phase 3 단독 (이 phase)**: latency -13.7% — 작음
- **Phase 2+3 결합 (phase2-3-bun-js-daemon)**: latency -84.6%
- **Phase 2 단독 (phase2-bun-js)**: latency -85.4%

→ Phase 3는 Phase 2와 **결합해도** latency를 추가로 줄이지 않음 (오히려
약간 작음). **Phase 3의 진짜 가치는 latency가 아닌 운영 properties** —
multi-user 시나리오에서 server connection 재사용 / batch 가능성. 단일
사용자 self-hosted 측정에서는 그 가치가 안 보임.

## 한계 / 다음 단계

- 단일 적용은 권장하지 않음 (Phase 2와 결합도 latency 우위 없음).
- Daemon의 메모리 상주 비용이 hook 호출 빈도가 충분히 높을 때만 정당화됨.
- **Multi-user 시나리오 측정이 필요**: N명 동시 hook 트래픽에서 daemon이
  batching / connection pooling으로 server 부하를 얼마나 줄이는지 — 그게
  Phase 3의 본질적 가치이고 이번 측정은 그걸 안 검증.
