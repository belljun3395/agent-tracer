# Agent Tracer — Performance Baseline

> 모든 측정은 동일한 Docker 자원 제한(`1 vCPU / 512 MiB` 서버, `1 vCPU / 256 MiB` 벤치마크 컨테이너) 아래 실행.

## AS-IS Baseline

> **Status: DONE** — 2026-05-05 재측정 (n=200, 5 runs × 5 phases = 25 baseline 측정)
>
> ```bash
> bash scripts/run-all-phases.sh 5 200 20
> ```

환경: Docker project `agent-tracer-bench`, server `cpus: 1.0 / mem_limit: 512m`, 벤치마크 컨테이너 `--cpus=1.0 / --memory=256m`, 훅 × 200 iterations + 20 warmup, concurrency 1.

### Hook Wall-Clock p99 (ms) — 가장 안정적인 baseline (phase2-3 sweep 5 runs median)

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP | 251.4 | 242.7 | 203.9 | 204.9 | 245.6 | **229.67** |

### 5개 phase sweep 전체 baseline 분포

n=200, 각 phase별 5 runs median 기준:

| 측정 시점 (phase 순회) | Avg p99 baseline (ms) |
|---|---:|
| phase2-node-js | 287.54 |
| phase2-bun-ts | 234.37 |
| phase2-bun-js | 234.62 |
| phase3-daemon-uds | 230.61 |
| phase2-3-bun-js-daemon | 229.67 |
| **mean ± stddev** | **243.36 ± 24.76** |

> phase2-node-js 287.54는 sweep 첫 phase의 cold-cache 영향이 포함된 값.
> 이후 4 phase는 230 ± 3 ms로 매우 일관됨.

### Container Resource & Server (phase2-3 baseline 기준)

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP | 99.93 / 103.46 | 71.43 / 106.90 | 9.89 | 9.91 | 9.97 | 0 | 0.02 | 52.13 |

Sweep artifact: `observability/results/sweep-2026-05-05T02-40-03Z/`
Median run artifacts (per-phase): 각 `*.log` 파일 끝의 `Median artifact:` 라인 참조.

---

## Phase 측정 가이드

각 phase 브랜치에서 harness를 실행하면 `baseline` + phase TO-BE 두 항목이 순서대로 측정된다.
결과 JSON에서 아래 항목을 뽑아 해당 phase의 `notes/perf/` 문서에 추가할 것.

```
측정일시:
harness 파라미터: --iterations N --warmup N --cpus X --memory Xm
artifact JSON 경로: observability/results/docker-phase-bench/<timestamp>/...
```

### 채워야 할 표

**Hook Wall-Clock p99 (ms)**

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | — | — | — | — | — | (baseline에서 복사) |
| <phase 설명> | | | | | | |

**Container Resource & Server**

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | — | — | — | — | — | — | — | — |
| <phase 설명> | | | | | | | | |

**AS-IS 대비 개선율**

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | | | |
| CPU avg (%) | | | |
| Memory avg (MiB) | | | |

---

## Prior Measurements (2026-05-03, pre-reorganization)

> **Stale**: AS-IS 베이스라인 없이 phase 간 상대 비교로 측정. 또한 Prometheus → server scrape가 실패한 환경(`up{job="agent-tracer-server"} = 0`)에서 측정되어 server-side 지표가 부정확. 참고용으로만.

### Hook Wall-Clock p99 (ms)

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + compiled JS + HTTP | 255.55 | 147.97 | 51.87 | 50.81 | 91.99 | 119.64 |
| node + tsx + UDS daemon | 286.28 | 296.37 | 263.78 | 193.68 | 229.68 | 253.96 |
| node + compiled JS + UDS daemon | 38.38 | 61.43 | 31.21 | 29.04 | 37.49 | 39.51 |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | 5xx | Event loop p99 (s) |
|---|---:|---:|---:|---:|---:|---:|
| node + compiled JS + HTTP | 87.32 / 99.69 | 34.87 / 57.57 | 4.97 | 22.43 | 0 | 0.01 |
| node + tsx + UDS daemon | 96.14 / 101.25 | 120.23 / 152.90 | 20.00 | 22.43 | 0 | 0.01 |
| node + compiled JS + UDS daemon | 81.94 / 101.46 | 102.11 / 117.10 | 13.19 | 35.00 | 0 | 0.01 |

Notes:
- compiled JS + UDS daemon이 평균 hook p99 39.51ms로 가장 빠름.
- tsx 단독 daemon은 기동 비용이 남아 compiled JS보다 느림.
- 모든 variant hook failure 0, server 5xx 0.
