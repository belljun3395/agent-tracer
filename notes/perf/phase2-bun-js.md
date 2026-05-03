# Phase 2: bun + compiled JS + HTTP

## 개요

Hook을 `esbuild`로 미리 번들링한 JS 파일로 만들어 두고, **bun**으로 실행.
phase2-bun-ts (TS 직접 실행)와 phase2-node-js (compiled JS + node) 두
접근의 합성: bun의 빠른 startup + compile-time bundling.

## 측정 (2026-05-05, n=200, 5 runs)

**median run**: `2026-05-05T03-45-49-128Z`

### 5-run 안정성

| run | score (avg phase p99 ms) |
|---|---:|
| run 1 | 135.04 |
| run 2 | 152.46 |
| run 3 | 134.45 ← MEDIAN |
| run 4 | 133.73 |
| run 5 | 132.78 |

Mean ± stddev: **137.69 ± 8.30 ms (n=5)**

### Hook Wall-Clock p99 (ms) — median run

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 254.1 | 249.8 | 210.8 | 210.1 | 248.2 | 234.62 |
| bun + compiled JS + HTTP (TO-BE) | 40.8 | 39.4 | 31.6 | 20.9 | 38.8 | **34.28** |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 99.75 / 103.49 | 66.73 / 105.90 | 4.98 | 9.84 | 9.99 | 0 | 0.02 | 46.23 |
| bun + compiled JS + HTTP (TO-BE) | 84.86 / 100.10 | 41.36 / 57.26 | 5.00 | 9.95 | 9.96 | 0 | 0.03 | 46.34 |

### AS-IS 대비 개선율

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 234.62 | 34.28 | **−85.4 %** |
| CPU avg (%) | 99.75 | 84.86 | −14.9 pp |
| Memory avg (MiB) | 66.73 | 41.36 | **−38.0 %** |

## 분석

- 같은 Phase 2 변종 중 가장 빠름. bun의 startup이 native TS보다도 compiled
  JS를 더 빠르게 처리 (parser/typecheck 자체가 사라지므로).
- bun-ts 대비:
  - Avg p99: 41.26 → 34.28 ms (-17%)
  - CPU avg: 82.74 → 84.86% (비슷)
  - V8 heap: 51.26 → 46.34 MiB

## 결론

Phase 2 변종 중 **bun + compiled JS** 조합이 모든 지표에서 best.

| Phase 2 변종 | Avg hook p99 | CPU avg | Mem avg |
|---|---:|---:|---:|
| node + compiled JS | 77.70 | 98.24 | 42.64 |
| bun + TS | 41.26 | 82.74 | 42.06 |
| **bun + compiled JS** | **34.28** | **84.86** | **41.36** |

## Phase 3와 결합 시

phase2-3-bun-js-daemon (이 phase + UDS daemon) = -84.6%로 **이 phase
단독 -85.4%보다 약간 작은** 결과. 즉 **단일 사용자 self-hosted 시나리오에서는
daemon이 latency 우위를 주지 않음**. Phase 3의 의의는 multi-user / server-side
부하 감소에 있음 — phase-summary.md 참조.
