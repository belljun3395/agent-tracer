# Agent Tracer — Performance Baseline

> 모든 측정은 동일한 Docker 자원 제한(`1 vCPU / 512 MiB` 서버, `1 vCPU / 256 MiB` 벤치마크 컨테이너) 아래 실행.

## AS-IS Baseline

> **Status: DONE** — 2026-05-03, Docker project `agent-tracer-bench`
>
> ```bash
> node scripts/benchmark-phases-docker.mjs \
>   --iterations 50 --warmup 10 --concurrency 1 \
>   --cpus 1.0 --memory 256m
> ```

환경: Docker project `agent-tracer-bench`, server `cpus: 1.0 / mem_limit: 512m`, 벤치마크 컨테이너 `--cpus=1.0 / --memory=256m`, 훅 × 50 iterations + 10 warmup, concurrency 1.

### Hook Wall-Clock p99 (ms)

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP | 252.97 | 248.31 | 298.32 | 697.52 | 918.01 | 483.03 |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP | 96.42 / 105.61 | 65.37 / 103.60 | 13.75 | 9.98 | 45.00 | 0 | 0.01 | 45.28 |

Artifact: `observability/results/docker-phase-bench/2026-05-03T15-38-26-395Z/`

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
