# Phase 2: node + compiled JS + HTTP

## 개요

Claude Code hook 진입점을 esbuild로 미리 번들링한 JS 파일로 만들어 두고,
node가 그것을 직접 실행하도록 변경. AS-IS는 매 hook 호출마다
`node + tsx` (런타임 transpile)으로 시작했음.

## 측정 (2026-05-05, n=200, 5 runs)

3-run × n=50 측정에서 5-run × n=200 측정으로 sample size 확대 후 재측정.
**median run**: `2026-05-05T02-53-52-499Z`

### 5-run 안정성

| run | score (avg phase p99 ms) |
|---|---:|
| run 1 | 350.83 |
| run 2 | 199.24 |
| run 3 | 182.62 ← MEDIAN |
| run 4 | 156.57 |
| run 5 | 157.08 |

Mean ± stddev: **209.27 ± 81.17 ms (n=5)**

> run 1이 sweep 시작 직후의 cold-cache 영향으로 outlier (350). run 2-5는
> 156-199 범위로 좁음. 이 phase가 sweep 첫 phase였기 때문에 outlier가
> 가장 큼 (이후 phase들은 stddev 3-8 ms 수준).

### Hook Wall-Clock p99 (ms) — median run

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 257.6 | 341.4 | 300.9 | 275.6 | 262.1 | 287.54 |
| node + compiled JS + HTTP (TO-BE) | 95.2 | 94.5 | 52.4 | 55.9 | 90.6 | **77.70** |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 99.81 / 103.34 | 66.72 / 104.70 | 9.96 | 9.86 | 20.72 | 0 | 0.02 | 47.85 |
| node + compiled JS + HTTP (TO-BE) | 98.24 / 100.21 | 42.64 / 61.24 | 5.00 | 20.75 | 9.99 | 0 | 0.02 | 52.88 |

### AS-IS 대비 개선율

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 287.54 | 77.70 | **−73.0 %** |
| CPU avg (%) | 99.81 | 98.24 | −1.57 pp |
| Memory avg (MiB) | 66.72 | 42.64 | **−36.1 %** |

## 분석

- 가장 큰 단축은 `PreToolUse` / `UserPromptSubmit` (각각 301→52, 276→56 ms,
  약 80%+ 감소). Payload가 작아 hook 로직 비중이 낮은 hook에서 startup
  비중이 가장 컸기 때문.
- Memory 사용량 -36% (67 → 43 MiB). tsx loader / transform pipeline 모듈
  트리가 사라진 효과.
- CPU avg는 99 → 98%로 거의 그대로 — TO-BE도 1 vCPU를 saturating. 단,
  같은 작업을 처리하는 데 걸리는 wall-clock이 1/4로 줄었으므로 throughput
  관점에선 큰 개선.

## 한계 / 다음 단계

- Hook 호출마다 node 프로세스를 새로 띄우는 cold start 비용이 floor
  (compiled JS 50–95 ms는 거의 node 인터프리터 시작 비용). 이를 없애려면
  Phase 3의 long-lived daemon 접근 (단, daemon의 진짜 가치는 multi-user
  시나리오 — phase-summary.md 참조).
- `phase2-bun-js` (-85.4%) 대비 -73.0%로 Phase 2 변종 중 가장 작은 개선.
  사용자 환경에 Bun 설치를 강제하지 않아도 되는 절충에 적합.
