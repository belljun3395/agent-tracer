# Phase 2: bun + TypeScript + HTTP

## 개요

Hook 진입점 실행 런타임을 `node + tsx`(런타임 transpile)에서 **bun**으로
교체. bun은 TypeScript를 native하게 실행해서 transpile/loader 비용이 사라짐.
hook 소스는 그대로 TS로 둠 (compile step 없음).

## 측정 (2026-05-05, n=200, 5 runs)

**median run**: `2026-05-05T03-21-24-950Z`

### 5-run 안정성

| run | score (avg phase p99 ms) |
|---|---:|
| run 1 | 150.02 |
| run 2 | 136.50 |
| run 3 | 137.82 ← MEDIAN |
| run 4 | 138.48 |
| run 5 | 135.98 |

Mean ± stddev: **139.76 ± 5.82 ms (n=5)** — 매우 안정적

### Hook Wall-Clock p99 (ms) — median run

| Variant | `SessionStart` | `StatusLine` | `PreToolUse` | `UserPromptSubmit` | `PostToolUse/Bash` | Avg p99 |
|---|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 254.5 | 250.9 | 205.6 | 208.7 | 252.2 | 234.37 |
| bun + TS + HTTP (TO-BE) | 51.6 | 46.0 | 31.0 | 31.0 | 46.7 | **41.26** |

### Container Resource & Server

| Variant | CPU avg/max (%) | Memory avg/max (MiB) | `/sessions/ensure` p99 (ms) | `/workflow` p99 (ms) | `/tool-activity` p99 (ms) | 5xx | Event loop p99 (s) | V8 heap (MiB) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| node + tsx + HTTP (AS-IS) | 99.47 / 103.82 | 70.90 / 105.90 | 9.78 | 9.93 | 10.80 | 0 | 0.02 | 53.48 |
| bun + TS + HTTP (TO-BE) | 82.74 / 89.92 | 42.06 / 59.55 | 11.12 | 9.96 | 9.99 | 0 | 0.03 | 51.26 |

### AS-IS 대비 개선율

| 지표 | AS-IS | TO-BE | Δ |
|---|---:|---:|---:|
| Avg hook p99 (ms) | 234.37 | 41.26 | **−82.4 %** |
| CPU avg (%) | 99.47 | 82.74 | −16.7 pp |
| Memory avg (MiB) | 70.90 | 42.06 | **−40.7 %** |

## 분석

- 모든 hook이 200ms 이상 → 50ms 이하로 떨어짐. tsx의 transpile + ESM
  loader 비용이 hook 실제 작업의 압도적인 비중이었음을 확인.
- CPU avg 99 → 83% — bun이 시작 자체가 가벼워서 같은 작업 처리에 CPU를
  훨씬 덜 씀.
- Memory도 71 → 42 MiB로 -40.7% 감소.
- Server p99이 baseline 대비 거의 동일 (4.97 → 11.12 ms 미세 증가). hook이
  빨라져 요청 도착이 더 burst성이 됐을 가능성 (다만 concurrency=1).

## 한계 / 다음 단계

- 여전히 매 hook 호출마다 bun 프로세스가 새로 떴다 사라짐 (cold start
  ~30–50ms 정도가 floor). Phase 3의 daemon으로 이 floor도 제거 가능.
- bun + 미리 번들링된 JS (phase2-bun-js, -85.4%)가 더 빠름 — 사용자가
  TS 소스를 그대로 두고 싶을 때만 이 변종을 선호.
